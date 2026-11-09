import "server-only"
import { seoulNow } from "../format"
import type { AppData, BuildingInput, ContractInput, PaymentInput, RoomInput } from "../types"
import { sheetUrl, sheetsConfig } from "./google"
import { mockStore } from "./mock-store"
import { sheetsStore } from "./sheets-store"

const isSheetsMode = () => !!sheetsConfig()
const store = () => (isSheetsMode() ? sheetsStore : mockStore)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

function newId(prefix: string) {
  const s = seoulNow().stamp.replace(/\D/g, "").slice(2)
  return `${prefix}-${s}-${Math.floor(Math.random() * 900 + 100)}`
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

export async function recordPayment(p: PaymentInput) {
  if (!p.contractId || !p.month) throw new Error("계약과 청구월이 필요합니다.")
  if (!(p.amount > 0)) throw new Error("입금액을 확인하세요.")
  if (!MONTH.test(p.month)) throw new Error("청구월 형식은 YYYY-MM 입니다.")
  if (!DATE.test(p.date)) throw new Error("입금일을 확인하세요.")
  const { contracts } = await store().readAll()
  const c = contracts.find((x) => x.id === p.contractId)
  if (!c) throw new Error("계약을 찾을 수 없습니다.")
  await store().append("payments", [newId("P"), c.id, c.roomId, p.month, p.amount, p.date, p.method || "계좌이체", p.memo || "", seoulNow().stamp])
}

export async function deletePayment(id: string) {
  const { payments } = await store().readAll()
  const hit = payments.find((p) => p.id === id)
  if (!hit) throw new Error("수납 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  await store().deleteRow("payments", hit.row)
}

export async function saveContract(c: ContractInput) {
  if (!c.roomId) throw new Error("호실을 선택하세요.")
  if (!c.tenant.trim()) throw new Error("임차인 이름을 입력하세요.")
  if (c.type !== "월세" && c.type !== "전세") throw new Error("유형은 월세 또는 전세입니다.")
  if (!DATE.test(c.start) || !DATE.test(c.end)) throw new Error("계약 기간을 확인하세요.")
  if (c.end < c.start) throw new Error("종료일이 시작일보다 빠릅니다.")
  const payDay = Math.min(31, Math.max(1, Math.round(c.payDay) || 1))
  const rent = c.type === "전세" ? 0 : c.rent

  const { contracts, rooms } = await store().readAll()
  if (!rooms.some((r) => r.id === c.roomId)) throw new Error("호실을 찾을 수 없습니다.")
  const overlap = contracts.find(
    (x) => x.roomId === c.roomId && x.status === "진행" && x.id !== (c.id ?? "") && x.start <= c.end && x.end >= c.start,
  )
  if (overlap) throw new Error(`같은 기간에 진행 중인 계약(${overlap.tenant})이 있습니다. 기존 계약을 먼저 종료하세요.`)

  const values = [c.roomId, c.tenant.trim(), c.phone.trim(), c.type, c.deposit, rent, c.fee, payDay, c.start, c.end]
  if (c.id) {
    const hit = contracts.find((x) => x.id === c.id)
    if (!hit) throw new Error("계약을 찾을 수 없습니다.")
    await store().updateCells("contracts", hit.row, "호실ID", [...values, hit.status, c.memo])
    return
  }
  await store().append("contracts", [newId("C"), ...values, "진행", c.memo, seoulNow().stamp])
}

export async function endContract(id: string, end: string) {
  if (!DATE.test(end)) throw new Error("퇴실일을 확인하세요.")
  const { contracts } = await store().readAll()
  const hit = contracts.find((x) => x.id === id)
  if (!hit) throw new Error("계약을 찾을 수 없습니다.")
  if (end < hit.start) throw new Error("퇴실일이 계약 시작일보다 빠릅니다.")
  await store().updateCells("contracts", hit.row, "종료일", [end, "종료"])
}

/* ───────── 건물 ───────── */

const BUILDING_CODE = /^[A-Z0-9]{1,6}$/

export async function saveBuilding(b: BuildingInput) {
  const name = b.name.trim()
  if (!name) throw new Error("건물명을 입력하세요.")
  const { buildings } = await store().readAll()
  if (buildings.some((x) => x.name === name && x.id !== b.id)) throw new Error(`「${name}」 건물이 이미 있습니다.`)

  if (b.id) {
    const hit = buildings.find((x) => x.id === b.id)
    if (!hit) throw new Error("건물을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
    await store().updateCells("buildings", hit.row, "건물명", [name, b.address.trim(), b.memo.trim()])
    return
  }
  const code = b.code.trim().toUpperCase()
  if (!BUILDING_CODE.test(code)) throw new Error("건물 코드는 영문 대문자·숫자 1~6자입니다. 예: CC, SH")
  if (buildings.some((x) => x.id === code)) throw new Error(`건물 코드 ${code} 가 이미 있습니다.`)
  await store().append("buildings", [code, name, b.address.trim(), b.memo.trim()])
}

export async function deleteBuilding(id: string) {
  const { buildings, rooms } = await store().readAll()
  const hit = buildings.find((x) => x.id === id)
  if (!hit) throw new Error("건물을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  const n = rooms.filter((r) => r.buildingId === id).length
  if (n) throw new Error(`호실이 ${n}개 있어 삭제할 수 없습니다. 호실을 먼저 삭제하세요.`)
  await store().deleteRow("buildings", hit.row)
}

/* ───────── 호실 ───────── */

const ROOM_NO = /^[0-9A-Za-z]{1,8}$/

export async function saveRoom(r: RoomInput) {
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
    await store().updateCells("rooms", hit.row, "호수", [no, r.floor, area, memo])
    return
  }
  if (!buildings.some((b) => b.id === r.buildingId)) throw new Error("건물을 선택하세요.")
  const id = `${r.buildingId}-${no}`
  if (rooms.some((x) => x.id === id || (x.buildingId === r.buildingId && x.no === no))) throw new Error(`${no}호가 이미 있습니다.`)
  await store().append("rooms", [id, r.buildingId, no, r.floor, area, memo])
}

export async function deleteRoom(id: string) {
  const { rooms, contracts, payments } = await store().readAll()
  const hit = rooms.find((x) => x.id === id)
  if (!hit) throw new Error("호실을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  if (contracts.some((c) => c.roomId === id) || payments.some((p) => p.roomId === id))
    throw new Error("계약·수납 기록이 있는 호실은 삭제할 수 없습니다.")
  await store().deleteRow("rooms", hit.row)
}
