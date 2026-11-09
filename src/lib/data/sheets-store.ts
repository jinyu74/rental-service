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

/* ───────── 쓰기 ─────────
 * 모든 쓰기는 batchUpdate 한 번으로 보내고, 맨 앞에 「내 잠금 탭 A1 에 지금 시각 적기」를 넣는다.
 * batchUpdate 는 전부 적용되거나 전부 거절되므로, 그사이 잠금을 빼앗겨(오래된 잠금으로 정리돼) 내 잠금 탭이
 * 없어졌다면 데이터 쓰기도 함께 거절된다(펜싱). 정상일 때는 잠금 시각이 갱신돼 만료로 오인되지 않는다.
 */
type Cell = { userEnteredValue: { numberValue: number } | { stringValue: string } }
const cell = (v: string | number): Cell => ({ userEnteredValue: typeof v === "number" ? { numberValue: v } : { stringValue: v } })

let tabIds: Map<string, number> | null = null
async function tabId(key: SheetKey) {
  if (!tabIds) {
    const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>("?fields=sheets.properties(sheetId,title)")
    tabIds = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
  }
  const id = tabIds.get(SHEETS[key].name)
  if (id == null) {
    tabIds = null
    throw new Error(`「${SHEETS[key].name}」 탭이 없습니다.`)
  }
  return id
}

async function fencedWrite(request: object) {
  if (held == null) throw new Error("잠금 없이 시트에 쓸 수 없습니다.")
  const lock = held
  try {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { updateCells: { start: { sheetId: lock, rowIndex: 0, columnIndex: 0 }, rows: [{ values: [cell(Date.now())] }], fields: "userEnteredValue" } },
          request,
        ],
      }),
    })
  } catch (e) {
    if (e instanceof SheetsError && e.status === 400 && e.body.includes(String(lock))) throw new Error(LOST)
    if (e instanceof SheetsError && /No grid with id/i.test(e.body)) tabIds = null // 탭이 다시 만들어졌을 수 있다
    throw e
  }
}

async function append(key: SheetKey, row: (string | number)[]) {
  await fencedWrite({ appendCells: { sheetId: await tabId(key), rows: [{ values: row.map(cell) }], fields: "userEnteredValue" } })
}

/** 쓰기 직전에 대상 행의 ID 를 다시 확인한다. 사람이 시트에서 행을 지우거나 옮긴 경우 엉뚱한 행을 고치지 않도록 멈춘다 */
async function assertRowId(key: SheetKey, row: number, id: string) {
  const res = await sheetsFetch<{ values?: unknown[][] }>(`/values/${range(SHEETS[key].name, `A${row}`)}?valueRenderOption=UNFORMATTED_VALUE`)
  if (String(res.values?.[0]?.[0] ?? "").trim() !== id) throw new Error(STALE)
}

async function updateCells(key: SheetKey, row: number, id: string, fromHeader: string, values: (string | number)[]) {
  await assertRowId(key, row, id)
  const columnIndex = SHEETS[key].headers.indexOf(fromHeader as never)
  await fencedWrite({
    updateCells: { start: { sheetId: await tabId(key), rowIndex: row - 1, columnIndex }, rows: [{ values: values.map(cell) }], fields: "userEnteredValue" },
  })
}

async function deleteRow(key: SheetKey, row: number, id: string) {
  await assertRowId(key, row, id)
  await fencedWrite({ deleteDimension: { range: { sheetId: await tabId(key), dimension: "ROWS", startIndex: row - 1, endIndex: row } } })
}

/* ───────── 시트 잠금 ─────────
 * 구글 시트 API 에는 트랜잭션이 없고, Netlify 는 동시 요청을 서로 다른 서버 인스턴스에서 처리한다.
 * 그래서 시트 자체를 잠금으로 쓴다: 숨김 탭 「_lock」 을 만드는 데 성공한 요청만 쓰기를 진행한다.
 * 같은 이름의 탭은 하나만 만들 수 있어 addSheet 가 원자적인 「없으면 만들기」 역할을 한다.
 * 잠금 탭 A1 에는 마지막으로 쓴 시각(ms)을 적는다. 서버가 중간에 죽어 LOCK_TTL_MS 동안 갱신이 없는 잠금은 정리한다.
 * 정리된 잠금의 원래 주인이 뒤늦게 깨어나 쓰더라도 fencedWrite 가 거절하므로 데이터는 섞이지 않는다.
 */
const LOCK_TITLE = "_lock"
const LOCK_TTL_MS = 30_000
const LOCK_WAIT_MS = 8_000
const BUSY = "다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요."
const LOST = "저장이 너무 오래 걸려 취소했습니다. 새로고침 후 다시 시도하세요."

/** 이 프로세스가 지금 쥐고 있는 잠금 탭의 sheetId. localQueue 로 한 번에 하나의 트랜잭션만 돌므로 변수 하나로 충분하다 */
let held: number | null = null

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
              rows: [{ values: [cell(Date.now())] }],
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

/** 남아 있는 잠금이 LOCK_TTL_MS 동안 갱신되지 않았으면 지운다. 시트 ID 로 지우므로 그사이 새로 잡힌 잠금은 건드리지 않는다 */
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
  held = lock
  try {
    return await fn()
  } finally {
    held = null
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
