import "server-only"
import { CORE_KEYS, SHEETS, SHEET_KEYS, type SheetKey } from "./schema"
import { SheetsError, range, sheetsFetch } from "./google"
import { mapBuilding, mapContract, mapDeposit, mapExpense, mapFixedCost, mapPayment, mapQuickCost, mapBroker, mapRoom, toObjects, type Row } from "./normalize"
import { STALE, type Cells, type Segment, serialQueue, type Store, type Tables } from "./store"

type BatchGet = { valueRanges: { values?: unknown[][] }[] }

/** 마지막으로 읽은 각 탭의 실제 머리글. 쓰기 전에 나중에 추가된 열의 머리글이 있는지 보는 데 쓴다 */
const seenHeaders = new Map<SheetKey, string[]>()

async function batchGet(keys: readonly SheetKey[]) {
  const qs = keys.map((k) => "ranges=" + range(SHEETS[k].name)).join("&")
  const res = await sheetsFetch<BatchGet>(`/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`)
  keys.forEach((k, i) => seenHeaders.set(k, (res.valueRanges[i]?.values?.[0] ?? []).map((h) => String(h).trim())))
  return new Map(keys.map((k, i) => [k, toObjects(res.valueRanges[i]?.values)]))
}

async function readAll(): Promise<Tables> {
  let rows: Map<SheetKey, Row[]>
  try {
    rows = await batchGet(SHEET_KEYS)
  } catch (e) {
    if (!(e instanceof SheetsError && /Unable to parse range/.test(e.body))) throw e
    // 나중에 추가된 탭이 아직 없는 시트: 있는 탭만 읽고 나머지는 빈 목록으로 본다
    const titles = await tabTitles()
    if (CORE_KEYS.some((k) => !titles.has(SHEETS[k].name)))
      throw new Error("시트에 「건물·호실·계약·수납내역」 탭이 없습니다. pnpm setup-sheet 를 먼저 실행하세요.")
    rows = await batchGet(SHEET_KEYS.filter((k) => titles.has(SHEETS[k].name)))
  }
  const get = (k: SheetKey) => rows.get(k) ?? []
  return {
    buildings: get("buildings").map(mapBuilding),
    rooms: get("rooms").map(mapRoom),
    contracts: get("contracts").map(mapContract),
    payments: get("payments").map(mapPayment),
    deposits: get("deposits").map(mapDeposit),
    expenses: get("expenses").map(mapExpense),
    fixedCosts: get("fixedCosts").map(mapFixedCost),
    quickCosts: get("quickCosts").map(mapQuickCost),
    brokers: get("brokers").map(mapBroker),
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
async function tabTitles() {
  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>("?fields=sheets.properties(sheetId,title)")
  tabIds = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
  return tabIds
}
async function findTab(key: SheetKey) {
  return (tabIds ?? (await tabTitles())).get(SHEETS[key].name) ?? (await tabTitles()).get(SHEETS[key].name)
}
async function tabId(key: SheetKey) {
  const id = await findTab(key)
  if (id == null) throw new Error(`「${SHEETS[key].name}」 탭이 없습니다.`)
  return id
}

async function fencedWrite(...requests: object[]) {
  if (held == null) throw new Error("잠금 없이 시트에 쓸 수 없습니다.")
  const lock = held
  try {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { updateCells: { start: { sheetId: lock, rowIndex: 0, columnIndex: 0 }, rows: [{ values: [cell(Date.now())] }], fields: "userEnteredValue" } },
          ...requests,
        ],
      }),
    })
  } catch (e) {
    if (e instanceof SheetsError && e.status === 400 && e.body.includes(String(lock))) throw new Error(LOST)
    if (e instanceof SheetsError && /No grid with id|already exists/i.test(e.body)) tabIds = null // 탭이 다시 만들어졌을 수 있다
    throw e
  }
}

const rowsOf = (rows: (string | number)[][]) => rows.map((r) => ({ values: r.map(cell) }))

/**
 * 기존 탭 오른쪽에 나중에 추가된 열(예: 계약 탭의 중개소)이 아직 없으면, 머리글을 채우고 필요하면 열을 늘리는 요청을 만든다.
 * 데이터 쓰기와 같은 batchUpdate 에 넣으므로 머리글만 생기거나 데이터만 써지는 일은 없다.
 * 쓰기는 모두 트랜잭션 안에서 readAll 직후에 하므로 seenHeaders 는 방금 읽은 값이다.
 */
async function missingColumns(key: SheetKey, sheetId: number): Promise<object[]> {
  const want = SHEETS[key].headers as readonly string[]
  const have = seenHeaders.get(key)
  // 쓰기는 열 위치로 하므로, 앱이 아는 열의 이름·순서가 시트와 같은지 매번 먼저 본다(뒤에 사용자가 더 붙인 열은 상관없음)
  if (!have) throw new Error(`「${SHEETS[key].name}」 탭을 읽지 못했습니다. 새로고침 후 다시 시도하세요.`)
  if (!have.length) throw new Error(`「${SHEETS[key].name}」 탭에 머리글이 없습니다. pnpm setup-sheet 를 실행하세요.`)
  const wrong = want.findIndex((h, i) => i < have.length && have[i] !== h)
  if (wrong >= 0)
    throw new Error(`「${SHEETS[key].name}」 탭 ${wrong + 1}번째 열 머리글이 「${have[wrong]}」입니다(앱은 「${want[wrong]}」). 열 이름·순서를 바꾸지 마세요.`)
  if (have.length >= want.length) return []
  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; gridProperties?: { columnCount?: number } } }[] }>(
    "?fields=sheets.properties(sheetId,gridProperties.columnCount)",
  )
  const cols = meta.sheets.find((s) => s.properties.sheetId === sheetId)?.properties.gridProperties?.columnCount ?? 0
  return [
    ...(cols < want.length ? [{ appendDimension: { sheetId, dimension: "COLUMNS", length: want.length - cols } }] : []),
    { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: have.length }, rows: rowsOf([want.slice(have.length)]), fields: "userEnteredValue" } },
  ]
}

/** 데이터 쓰기 + (필요하면) 빠진 머리글 채우기를 한 번에 */
async function writeTo(key: SheetKey, sheetId: number, ...requests: object[]) {
  const fix = await missingColumns(key, sheetId)
  await fencedWrite(...fix, ...requests)
  if (fix.length) seenHeaders.set(key, [...SHEETS[key].headers])
}

async function append(key: SheetKey, rows: (string | number)[][]) {
  if (!rows.length) return
  const id = await findTab(key)
  if (id != null) return writeTo(key, id, { appendCells: { sheetId: id, rows: rowsOf(rows), fields: "userEnteredValue" } })
  if ((CORE_KEYS as readonly SheetKey[]).includes(key)) throw new Error(`「${SHEETS[key].name}」 탭이 없습니다.`)
  // 나중에 추가된 탭은 처음 쓸 때 머리글과 함께 만든다. 같은 batchUpdate 라 탭만 생기고 끝나는 일은 없다
  const sheetId = 1 + Math.floor(Math.random() * 2_000_000_000)
  const headers = SHEETS[key].headers as readonly string[]
  await fencedWrite(
    { addSheet: { properties: { sheetId, title: SHEETS[key].name, gridProperties: { rowCount: 1000, columnCount: headers.length, frozenRowCount: 1 } } } },
    { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: rowsOf([[...headers]]), fields: "userEnteredValue" } },
    { appendCells: { sheetId, rows: rowsOf(rows), fields: "userEnteredValue" } },
  )
  tabIds = null
}

/** 쓰기 직전에 대상 행의 ID 를 다시 확인한다. 사람이 시트에서 행을 지우거나 옮긴 경우 엉뚱한 행을 고치지 않도록 멈춘다 */
async function assertRowId(key: SheetKey, row: number, id: string) {
  const res = await sheetsFetch<{ values?: unknown[][] }>(`/values/${range(SHEETS[key].name, `A${row}`)}?valueRenderOption=UNFORMATTED_VALUE`)
  if (String(res.values?.[0]?.[0] ?? "").trim() !== id) throw new Error(STALE)
}

async function updateCells(key: SheetKey, row: number, id: string, fromHeader: string, values: Cells, more: Segment[] = []) {
  await assertRowId(key, row, id)
  const sheetId = await tabId(key)
  await writeTo(
    key,
    sheetId,
    ...[[fromHeader, values] as Segment, ...more].map(([from, vals]) => ({
      updateCells: {
        start: { sheetId, rowIndex: row - 1, columnIndex: SHEETS[key].headers.indexOf(from as never) },
        rows: [{ values: vals.map(cell) }],
        fields: "userEnteredValue",
      },
    })),
  )
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
