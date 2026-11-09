import "server-only"
import { SHEETS, type SheetKey } from "./schema"
import { SheetsError, range, sheetsFetch } from "./google"
import { mapBuilding, mapContract, mapPayment, mapRoom, toObjects } from "./normalize"
import { STALE, serialQueue, type Store, type Tables } from "./store"

type BatchGet = { valueRanges: { values?: unknown[][] }[] }

const KEYS: SheetKey[] = ["buildings", "rooms", "contracts", "payments"]

async function readAll(): Promise<Tables> {
  const qs = KEYS.map((k) => "ranges=" + range(SHEETS[k].name)).join("&")
  const res = await sheetsFetch<BatchGet>(
    `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  ).catch((e: Error) => {
    if (/Unable to parse range/.test(e.message)) throw new Error("시트에 「건물·호실·계약·수납내역」 탭이 없습니다. pnpm setup-sheet 를 먼저 실행하세요.")
    throw e
  })
  const [b, r, c, p] = res.valueRanges.map((v) => toObjects(v.values))
  return {
    buildings: b.map(mapBuilding),
    rooms: r.map(mapRoom),
    contracts: c.map(mapContract),
    payments: p.map(mapPayment),
  }
}

async function append(key: SheetKey, row: (string | number)[]) {
  await sheetsFetch(`/values/${range(SHEETS[key].name, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  })
}

const col = (i: number) => String.fromCharCode(65 + i)

/** 쓰기 직전에 대상 행의 ID 를 다시 확인한다. 읽은 뒤 다른 요청이 행을 지웠다면 엉뚱한 행을 고치지 않도록 멈춘다 */
async function assertRowId(key: SheetKey, row: number, id: string) {
  const res = await sheetsFetch<{ values?: unknown[][] }>(`/values/${range(SHEETS[key].name, `A${row}`)}?valueRenderOption=UNFORMATTED_VALUE`)
  if (String(res.values?.[0]?.[0] ?? "").trim() !== id) throw new Error(STALE)
}

async function updateCells(key: SheetKey, row: number, id: string, fromHeader: string, values: (string | number)[]) {
  await assertRowId(key, row, id)
  const start = SHEETS[key].headers.indexOf(fromHeader as never)
  const a1 = `${col(start)}${row}:${col(start + values.length - 1)}${row}`
  await sheetsFetch(`/values/${range(SHEETS[key].name, a1)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [values] }),
  })
}

async function deleteRow(key: SheetKey, row: number, id: string) {
  await assertRowId(key, row, id)
  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)",
  )
  const sh = meta.sheets.find((s) => s.properties.title === SHEETS[key].name)
  if (!sh) throw new Error(`「${SHEETS[key].name}」 탭이 없습니다.`)
  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: sh.properties.sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
    }),
  })
}

/* ───────── 시트 잠금 ─────────
 * 구글 시트 API 에는 트랜잭션이 없고, Netlify 는 동시 요청을 서로 다른 서버 인스턴스에서 처리한다.
 * 그래서 시트 자체를 잠금으로 쓴다: 숨김 탭 「_lock」 을 만드는 데 성공한 요청만 쓰기를 진행한다.
 * 같은 이름의 탭은 하나만 만들 수 있어 addSheet 가 원자적인 「없으면 만들기」 역할을 한다.
 * 잠금 탭 A1 에는 만든 시각(ms)을 적어, 서버가 중간에 죽어 남은 잠금은 LOCK_TTL_MS 뒤 정리한다.
 */
const LOCK_TITLE = "_lock"
const LOCK_TTL_MS = 30_000
const LOCK_WAIT_MS = 8_000
const BUSY = "다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요."

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isTaken = (e: unknown) => e instanceof SheetsError && e.status === 400 && /already exists/i.test(e.body)
const isMissing = (e: unknown) => e instanceof SheetsError && e.status === 400 && /Unable to parse range/i.test(e.body)

async function tryAcquire(): Promise<number | null> {
  const sheetId = 1 + Math.floor(Math.random() * 2_000_000_000)
  try {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { addSheet: { properties: { sheetId, title: LOCK_TITLE, hidden: true, gridProperties: { rowCount: 1, columnCount: 1 } } } },
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              rows: [{ values: [{ userEnteredValue: { numberValue: Date.now() } }] }],
              fields: "userEnteredValue",
            },
          },
        ],
      }),
    })
    return sheetId
  } catch (e) {
    if (isTaken(e)) return null
    throw e
  }
}

/** 남아 있는 잠금이 LOCK_TTL_MS 보다 오래됐으면 지운다. 시트 ID 로 지우므로 그사이 새로 잡힌 잠금은 건드리지 않는다 */
async function clearStaleLock() {
  type Meta = { sheets?: { properties: { sheetId: number }; data?: { rowData?: { values?: { effectiveValue?: { numberValue?: number } }[] }[] }[] }[] }
  let meta: Meta
  try {
    meta = await sheetsFetch<Meta>(
      `?ranges=${range(LOCK_TITLE, "A1")}&includeGridData=true&fields=sheets(properties(sheetId),data(rowData(values(effectiveValue))))`,
    )
  } catch (e) {
    if (isMissing(e)) return // 그사이 풀렸다
    throw e
  }
  const sh = meta.sheets?.[0]
  if (!sh) return
  const at = sh.data?.[0]?.rowData?.[0]?.values?.[0]?.effectiveValue?.numberValue ?? 0
  if (Date.now() - at < LOCK_TTL_MS) return
  await release(sh.properties.sheetId)
}

async function release(sheetId: number) {
  try {
    await sheetsFetch(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ deleteSheet: { sheetId } }] }) })
  } catch {
    // 이미 지워졌거나(오래된 잠금으로 정리됨) 일시 오류. 남은 잠금은 LOCK_TTL_MS 뒤 정리된다
  }
}

async function withSheetLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + LOCK_WAIT_MS
  let lock: number | null
  for (let i = 0; (lock = await tryAcquire()) === null; i++) {
    await clearStaleLock()
    if (Date.now() > deadline) throw new Error(BUSY)
    await sleep(Math.min(200 * 2 ** i, 1000) * (0.5 + Math.random()))
  }
  try {
    return await fn()
  } finally {
    await release(lock)
  }
}

// 같은 인스턴스 안의 요청은 먼저 줄 세워, 자기들끼리 시트 잠금을 두고 다투지 않게 한다
const localQueue = serialQueue()

export const sheetsStore: Store = {
  readAll,
  append,
  updateCells,
  deleteRow,
  transaction: (fn) => localQueue(() => withSheetLock(fn)),
}
