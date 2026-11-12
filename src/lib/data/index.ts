import "server-only"
import { seoulNow } from "../format"
import type { AppData, BrokerInput, BuildingInput, ContractInput, DepositInput, ExpenseInput, FixedCostInput, FixedRunInput, PaymentInput, QuickRunInput, RoomInput } from "../types"
import { sheetUrl, sheetsConfig } from "./google"
import { mockStore } from "./mock-store"
import { sheetsStore } from "./sheets-store"

const isSheetsMode = () => !!sheetsConfig()
const store = () => (isSheetsMode() ? sheetsStore : mockStore)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

function newId(prefix: string, taken?: Set<string>) {
  const s = seoulNow().stamp.replace(/\D/g, "").slice(2)
  for (;;) {
    const id = `${prefix}-${s}-${Math.floor(Math.random() * 900 + 100)}`
    if (!taken?.has(id)) return taken?.add(id), id
  }
}

/**
 * 모든 쓰기는 저장소 트랜잭션 안에서 「읽고 → 검사하고 → 쓴다」.
 * 구글 시트 모드에서는 시트 잠금(sheets-store 의 _lock 탭)으로 서버 인스턴스끼리도 겹치지 않는다.
 */
function exclusive<A extends unknown[]>(fn: (...a: A) => Promise<void>) {
  return (...a: A): Promise<void> => store().transaction(() => fn(...a))
}

export async function getData(): Promise<AppData> {
  const t = await store().readAll()
  const now = seoulNow()
  return {
    ...t,
    today: now.date,
    syncedAt: now.time,
    sheetUrl: sheetUrl(),
    source: isSheetsMode() ? "sheets" : "mock",
  }
}

async function _recordPayment(p: PaymentInput) {
  if (!p.contractId || !p.month) throw new Error("계약과 청구월이 필요합니다.")
  if (!(p.amount > 0)) throw new Error("입금액을 확인하세요.")
  if (!MONTH.test(p.month)) throw new Error("청구월 형식은 YYYY-MM 입니다.")
  if (!DATE.test(p.date)) throw new Error("입금일을 확인하세요.")
  const { contracts } = await store().readAll()
  const c = contracts.find((x) => x.id === p.contractId)
  if (!c) throw new Error("계약을 찾을 수 없습니다.")
  await store().append("payments", [[newId("P"), c.id, c.roomId, p.month, p.amount, p.date, p.method || "계좌이체", p.memo || "", seoulNow().stamp]])
}

async function _deletePayment(id: string) {
  const { payments } = await store().readAll()
  const hit = payments.find((p) => p.id === id)
  if (!hit) throw new Error("수납 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  await store().deleteRow("payments", hit.row, hit.id)
}

async function _saveContract(c: ContractInput) {
  if (!c.roomId) throw new Error("호실을 선택하세요.")
  if (!c.tenant.trim()) throw new Error("임차인 이름을 입력하세요.")
  if (c.type !== "월세" && c.type !== "전세") throw new Error("유형은 월세 또는 전세입니다.")
  if (!DATE.test(c.start) || !DATE.test(c.end)) throw new Error("계약 기간을 확인하세요.")
  if (c.end < c.start) throw new Error("종료일이 시작일보다 빠릅니다.")
  // 납부방식을 보내지 않는 예전 화면(배포 직후 열려 있던 탭)은 선불로 저장
  const payMode = c.payMode ?? "선불"
  if (payMode !== "선불" && payMode !== "후불") throw new Error("납부 방식은 선불 또는 후불입니다.")
  const payDay = Math.min(31, Math.max(1, Math.round(c.payDay) || 1))
  const rent = c.type === "전세" ? 0 : c.rent

  const { contracts, rooms, brokers } = await store().readAll()
  if (!rooms.some((r) => r.id === c.roomId)) throw new Error("호실을 찾을 수 없습니다.")
  const overlap = contracts.find(
    (x) => x.roomId === c.roomId && x.status === "진행" && x.id !== (c.id ?? "") && x.start <= c.end && x.end >= c.start,
  )
  if (overlap) throw new Error(`같은 기간에 진행 중인 계약(${overlap.tenant})이 있습니다. 기존 계약을 먼저 종료하세요.`)

  // 중개소: 목록에서 고르거나, 새 이름이면 「중개소」 탭에 먼저 등록한다(같은 이름이 이미 있으면 그걸 쓴다)
  const brokerFee = Math.round(Number(c.brokerFee) || 0)
  if (brokerFee < 0) throw new Error("중개수수료를 확인하세요.")
  let broker: { id: string; name: string } | null = null
  const newName = c.newBroker?.name.trim() ?? ""
  if (c.brokerId) {
    broker = brokers.find((b) => b.id === c.brokerId) ?? null
    if (!broker) throw new Error("중개소를 찾을 수 없습니다. 새로고침 후 다시 선택하세요.")
  } else if (newName) {
    broker = brokers.find((b) => sameName(b.name, newName)) ?? null
    if (!broker) {
      broker = { id: newId("BK", new Set(brokers.map((b) => b.id))), name: newName }
      await store().append("brokers", [[broker.id, newName, c.newBroker!.phone.trim(), "", ""]])
    }
  }
  if (brokerFee > 0 && !broker) throw new Error("중개수수료가 있으면 중개소를 선택하세요.")
  const values = [c.roomId, c.tenant.trim(), c.phone.trim(), c.type, c.deposit, rent, c.fee, payDay, c.start, c.end]
  // 등록일시 뒤 열: 중개소·중개수수료·중개소ID·납부방식
  const tail = [...(broker ? [broker.name, brokerFee, broker.id] : ["", 0, ""]), payMode]
  if (c.id) {
    const hit = contracts.find((x) => x.id === c.id)
    if (!hit) throw new Error("계약을 찾을 수 없습니다.")
    // 등록일시 열은 건드리지 않고, 그 앞(호실ID~메모)과 뒤(중개 정보·납부방식)를 한 번에 쓴다
    await store().updateCells("contracts", hit.row, hit.id, "호실ID", [...values, hit.status, c.memo], [["중개소", tail]])
    return
  }
  await store().append("contracts", [[newId("C"), ...values, "진행", c.memo, seoulNow().stamp, ...tail]])
}

async function _endContract(id: string, end: string) {
  if (!DATE.test(end)) throw new Error("퇴실일을 확인하세요.")
  const { contracts } = await store().readAll()
  const hit = contracts.find((x) => x.id === id)
  if (!hit) throw new Error("계약을 찾을 수 없습니다.")
  if (end < hit.start) throw new Error("퇴실일이 계약 시작일보다 빠릅니다.")
  await store().updateCells("contracts", hit.row, hit.id, "종료일", [end, "종료"])
}

/* ───────── 중개소 ───────── */

/** 띄어쓰기만 다른 이름(「한빛 공인중개사」·「한빛공인중개사」)은 같은 중개소로 본다 */
const sameName = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "")

async function _saveBroker(b: BrokerInput) {
  const name = b.name.trim()
  if (!name) throw new Error("중개소 이름을 입력하세요.")
  const { brokers } = await store().readAll()
  const dup = brokers.find((x) => sameName(x.name, name) && x.id !== b.id)
  if (dup) throw new Error(`「${dup.name}」 중개소가 이미 있습니다.`)
  const values = [name, b.phone.trim(), b.address.trim(), b.memo.trim()]
  if (b.id) {
    const hit = brokers.find((x) => x.id === b.id)
    if (!hit) throw new Error("중개소를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    await store().updateCells("brokers", hit.row, hit.id, "이름", values)
    return
  }
  await store().append("brokers", [[newId("BK", new Set(brokers.map((x) => x.id))), ...values]])
}

async function _deleteBroker(id: string) {
  const { brokers, contracts } = await store().readAll()
  const hit = brokers.find((x) => x.id === id)
  if (!hit) throw new Error("중개소를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  const n = contracts.filter((c) => c.brokerId === id).length
  if (n) throw new Error(`이 중개소로 맺은 계약이 ${n}건 있어 삭제할 수 없습니다.`)
  await store().deleteRow("brokers", hit.row, hit.id)
}

/* ───────── 건물 ───────── */

const BUILDING_CODE = /^[A-Z0-9]{1,6}$/

async function _saveBuilding(b: BuildingInput) {
  const name = b.name.trim()
  if (!name) throw new Error("건물명을 입력하세요.")
  const { buildings } = await store().readAll()
  if (buildings.some((x) => x.name === name && x.id !== b.id)) throw new Error(`「${name}」 건물이 이미 있습니다.`)

  if (b.id) {
    const hit = buildings.find((x) => x.id === b.id)
    if (!hit) throw new Error("건물을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    await store().updateCells("buildings", hit.row, hit.id, "건물명", [name, b.address.trim(), b.memo.trim()])
    return
  }
  const code = b.code.trim().toUpperCase()
  if (!BUILDING_CODE.test(code)) throw new Error("건물 코드는 영문 대문자·숫자 1~6자입니다. 예: A, B2")
  if (buildings.some((x) => x.id === code)) throw new Error(`건물 코드 ${code} 가 이미 있습니다.`)
  await store().append("buildings", [[code, name, b.address.trim(), b.memo.trim()]])
}

async function _deleteBuilding(id: string) {
  const { buildings, rooms, expenses, fixedCosts, quickCosts } = await store().readAll()
  const hit = buildings.find((x) => x.id === id)
  if (!hit) throw new Error("건물을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  const n = rooms.filter((r) => r.buildingId === id).length
  if (n) throw new Error(`호실이 ${n}개 있어 삭제할 수 없습니다. 호실을 먼저 삭제하세요.`)
  if (expenses.some((e) => e.buildingId === id) || fixedCosts.some((f) => f.buildingId === id) || quickCosts.some((f) => f.buildingId === id))
    throw new Error("지출 기록이나 정기·자주 쓰는 지출 항목이 있는 건물은 삭제할 수 없습니다.")
  await store().deleteRow("buildings", hit.row, hit.id)
}

/* ───────── 호실 ───────── */

const ROOM_NO = /^[0-9A-Za-z]{1,8}$/

async function _saveRoom(r: RoomInput) {
  const no = r.no.trim().toUpperCase()
  if (!ROOM_NO.test(no)) throw new Error("호수는 영문·숫자 1~8자입니다. 예: 301, B01")
  if (!Number.isInteger(r.floor) || r.floor < -9 || r.floor > 99) throw new Error("층을 확인하세요. 지하는 -1 처럼 입력합니다.")
  if (r.area != null && !(r.area > 0)) throw new Error("면적은 0보다 커야 합니다. 모르면 비워두세요.")
  const area = r.area ?? ""
  const memo = r.memo.trim()

  const { buildings, rooms } = await store().readAll()
  if (r.id) {
    const hit = rooms.find((x) => x.id === r.id)
    if (!hit) throw new Error("호실을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    if (rooms.some((x) => x.buildingId === hit.buildingId && x.no === no && x.id !== hit.id)) throw new Error(`${no}호가 이미 있습니다.`)
    // 호실ID 는 계약·수납 기록과 연결돼 있어 바꾸지 않는다
    await store().updateCells("rooms", hit.row, hit.id, "호수", [no, r.floor, area, memo])
    return
  }
  if (!buildings.some((b) => b.id === r.buildingId)) throw new Error("건물을 선택하세요.")
  const id = `${r.buildingId}-${no}`
  if (rooms.some((x) => x.id === id || (x.buildingId === r.buildingId && x.no === no))) throw new Error(`${no}호가 이미 있습니다.`)
  await store().append("rooms", [[id, r.buildingId, no, r.floor, area, memo]])
}

async function _deleteRoom(id: string) {
  const { rooms, contracts, payments } = await store().readAll()
  const hit = rooms.find((x) => x.id === id)
  if (!hit) throw new Error("호실을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  if (contracts.some((c) => c.roomId === id) || payments.some((p) => p.roomId === id))
    throw new Error("계약·수납 기록이 있는 호실은 삭제할 수 없습니다.")
  await store().deleteRow("rooms", hit.row, hit.id)
}

/* ───────── 보증금 ───────── */

const DEPOSIT_KINDS = ["계약금", "잔금", "반환"]

async function _recordDeposit(d: DepositInput) {
  if (!DEPOSIT_KINDS.includes(d.kind)) throw new Error("구분은 계약금·잔금·반환 중 하나입니다.")
  if (!(d.amount > 0)) throw new Error("금액을 확인하세요.")
  if (!DATE.test(d.date)) throw new Error("날짜를 확인하세요.")
  const { contracts, deposits } = await store().readAll()
  const c = contracts.find((x) => x.id === d.contractId)
  if (!c) throw new Error("계약을 찾을 수 없습니다.")
  const mine = deposits.filter((x) => x.contractId === c.id)
  const received = mine.filter((x) => x.kind !== "반환").reduce((a, x) => a + x.amount, 0)
  const returned = mine.filter((x) => x.kind === "반환").reduce((a, x) => a + x.amount, 0)
  if (d.kind === "반환") {
    if (d.amount > received - returned) throw new Error(`돌려줄 보증금(${(received - returned).toLocaleString("ko-KR")}원)보다 많습니다.`)
  } else if (received + d.amount > c.deposit) {
    throw new Error(`약정 보증금 ${c.deposit.toLocaleString("ko-KR")}원을 넘습니다. 남은 금액은 ${Math.max(0, c.deposit - received).toLocaleString("ko-KR")}원입니다.`)
  }
  await store().append("deposits", [[newId("D"), c.id, c.roomId, d.kind, d.amount, d.date, d.method || "계좌이체", d.memo.trim(), seoulNow().stamp]])
}

async function _deleteDeposit(id: string) {
  const { deposits } = await store().readAll()
  const hit = deposits.find((x) => x.id === id)
  if (!hit) throw new Error("보증금 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  if (hit.kind !== "반환") {
    // 입금 기록을 지워도 「돌려준 돈 ≤ 받은 돈」 이 유지돼야 한다
    const rest = deposits.filter((x) => x.contractId === hit.contractId && x.id !== hit.id)
    const received = rest.filter((x) => x.kind !== "반환").reduce((a, x) => a + x.amount, 0)
    const returned = rest.filter((x) => x.kind === "반환").reduce((a, x) => a + x.amount, 0)
    if (returned > received) throw new Error("이 입금을 지우면 반환액이 입금액보다 많아집니다. 반환 기록을 먼저 고치거나 삭제하세요.")
  }
  await store().deleteRow("deposits", hit.row, hit.id)
}

/* ───────── 지출 ───────── */

function checkExpense(e: Pick<ExpenseInput, "month" | "item" | "amount" | "date">) {
  if (!MONTH.test(e.month)) throw new Error("귀속월 형식은 YYYY-MM 입니다.")
  if (!e.item.trim()) throw new Error("항목을 입력하세요.")
  if (!(e.amount > 0)) throw new Error("금액을 확인하세요.")
  if (!DATE.test(e.date)) throw new Error("지출일을 확인하세요.")
}

async function _saveExpense(e: ExpenseInput) {
  checkExpense(e)
  const { buildings, expenses } = await store().readAll()
  if (!buildings.some((b) => b.id === e.buildingId)) throw new Error("건물을 선택하세요.")
  if (e.id) {
    const hit = expenses.find((x) => x.id === e.id)
    if (!hit) throw new Error("지출 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    // 정기 지출은 정기 항목의 건물에 묶여 있고, 같은 항목은 한 달에 한 번만 기록된다
    const buildingId = hit.fixedId ? hit.buildingId : e.buildingId
    if (hit.fixedId && expenses.some((x) => x.id !== hit.id && x.fixedId === hit.fixedId && x.month === e.month))
      throw new Error(`${e.month} 에 이미 같은 정기 항목 지출이 있습니다.`)
    await store().updateCells("expenses", hit.row, hit.id, "건물ID", [buildingId, e.month, e.item.trim(), e.amount, e.date, e.memo.trim()])
    return
  }
  const values = [e.buildingId, e.month, e.item.trim(), e.amount, e.date, e.memo.trim()]
  await store().append("expenses", [[newId("E"), ...values, "", seoulNow().stamp]])
}

async function _deleteExpense(id: string) {
  const { expenses } = await store().readAll()
  const hit = expenses.find((x) => x.id === id)
  if (!hit) throw new Error("지출 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  await store().deleteRow("expenses", hit.row, hit.id)
}

/** 정기 항목과 자주 쓰는 항목은 같은 모양의 탭(ID, 건물ID, 항목, 기본금액, 메모)이라 저장 로직을 같이 쓴다 */
const PRESET = {
  fixedCosts: { prefix: "FX", label: "정기 항목" },
  quickCosts: { prefix: "Q", label: "자주 쓰는 항목" },
} as const
type PresetKey = keyof typeof PRESET

async function savePreset(key: PresetKey, f: FixedCostInput) {
  const { label, prefix } = PRESET[key]
  const item = f.item.trim()
  if (!item) throw new Error("항목 이름을 입력하세요.")
  if (!(f.amount >= 0)) throw new Error("기본 금액을 확인하세요.")
  const t = await store().readAll()
  const list = t[key]
  if (f.id) {
    const hit = list.find((x) => x.id === f.id)
    if (!hit) throw new Error(`${label}을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.`)
    if (list.some((x) => x.buildingId === hit.buildingId && x.item === item && x.id !== hit.id)) throw new Error(`「${item}」 항목이 이미 있습니다.`)
    await store().updateCells(key, hit.row, hit.id, "항목", [item, f.amount, f.memo.trim()])
    return
  }
  if (!t.buildings.some((b) => b.id === f.buildingId)) throw new Error("건물을 선택하세요.")
  if (list.some((x) => x.buildingId === f.buildingId && x.item === item)) throw new Error(`「${item}」 항목이 이미 있습니다.`)
  await store().append(key, [[newId(prefix, new Set(list.map((x) => x.id))), f.buildingId, item, f.amount, f.memo.trim()]])
}

async function deletePreset(key: PresetKey, id: string) {
  const list = (await store().readAll())[key]
  const hit = list.find((x) => x.id === id)
  if (!hit) throw new Error(`${PRESET[key].label}을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.`)
  // 이미 기록한 지출은 항목 이름을 그대로 갖고 있으므로 남겨둔다
  await store().deleteRow(key, hit.row, hit.id)
}

const _saveFixedCost = (f: FixedCostInput) => savePreset("fixedCosts", f)
const _deleteFixedCost = (id: string) => deletePreset("fixedCosts", id)
const _saveQuickCost = (f: FixedCostInput) => savePreset("quickCosts", f)
const _deleteQuickCost = (id: string) => deletePreset("quickCosts", id)

/** 자주 쓰는 항목 하나를 그 달 기타 지출로 기록하고 새 지출ID 를 돌려준다(되돌리기용). 같은 달 여러 번 기록 가능 */
async function _recordQuick(q: QuickRunInput): Promise<string> {
  if (!MONTH.test(q.month)) throw new Error("귀속월 형식은 YYYY-MM 입니다.")
  if (!DATE.test(q.date)) throw new Error("지출일을 확인하세요.")
  const { quickCosts, buildings, expenses } = await store().readAll()
  const f = quickCosts.find((x) => x.id === q.quickId)
  if (!f) throw new Error("자주 쓰는 항목을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  if (!buildings.some((b) => b.id === f.buildingId)) throw new Error("건물을 찾을 수 없습니다.")
  if (!(f.amount > 0)) throw new Error(`「${f.item}」 은 기본 금액이 없어 바로 기록할 수 없습니다. 금액을 입력해 기록하세요.`)
  const id = newId("E", new Set(expenses.map((e) => e.id)))
  await store().append("expenses", [[id, f.buildingId, q.month, f.item, f.amount, q.date, f.memo, "", seoulNow().stamp]])
  return id
}

/** 이번 달 정기 지출 한꺼번에 기록. 이미 기록된 항목은 건너뛴다(두 번 눌러도 중복되지 않음) */
async function _recordFixedRun(run: FixedRunInput): Promise<number> {
  if (!MONTH.test(run.month)) throw new Error("귀속월 형식은 YYYY-MM 입니다.")
  if (!DATE.test(run.date)) throw new Error("지출일을 확인하세요.")
  if (!run.items.length) throw new Error("기록할 항목을 선택하세요.")
  const { fixedCosts, expenses } = await store().readAll()
  const done = new Set(expenses.filter((e) => e.month === run.month && e.fixedId).map((e) => e.fixedId))
  const taken = new Set(expenses.map((e) => e.id))
  const stamp = seoulNow().stamp
  const rows: (string | number)[][] = []
  for (const it of run.items) {
    const f = fixedCosts.find((x) => x.id === it.fixedId && x.buildingId === run.buildingId)
    if (!f) throw new Error("정기 항목을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    if (done.has(f.id)) continue
    if (!(it.amount > 0)) throw new Error(`「${f.item}」 금액을 확인하세요.`)
    rows.push([newId("E", taken), f.buildingId, run.month, f.item, it.amount, run.date, "", f.id, stamp])
    done.add(f.id) // 한 요청 안에 같은 항목이 반복돼도 한 번만
  }
  if (!rows.length) throw new Error("선택한 항목은 이미 모두 기록되어 있습니다.")
  await store().append("expenses", rows)
  return rows.length
}

export const recordPayment = exclusive(_recordPayment)
export const deletePayment = exclusive(_deletePayment)
export const saveContract = exclusive(_saveContract)
export const endContract = exclusive(_endContract)
export const saveBuilding = exclusive(_saveBuilding)
export const deleteBuilding = exclusive(_deleteBuilding)
export const saveRoom = exclusive(_saveRoom)
export const deleteRoom = exclusive(_deleteRoom)
export const recordDeposit = exclusive(_recordDeposit)
export const deleteDeposit = exclusive(_deleteDeposit)
export const saveExpense = exclusive(_saveExpense)
export const deleteExpense = exclusive(_deleteExpense)
export const saveFixedCost = exclusive(_saveFixedCost)
export const deleteFixedCost = exclusive(_deleteFixedCost)
export const saveQuickCost = exclusive(_saveQuickCost)
export const deleteQuickCost = exclusive(_deleteQuickCost)
export const saveBroker = exclusive(_saveBroker)
export const deleteBroker = exclusive(_deleteBroker)
export const recordQuick = (q: QuickRunInput) => store().transaction(() => _recordQuick(q))
export const recordFixedRun = (run: FixedRunInput) => store().transaction(() => _recordFixedRun(run))
