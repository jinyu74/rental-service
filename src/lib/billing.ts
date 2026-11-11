import type { AppData, Building, Contract, Room } from "./types"
import { addMonth, daysBetween, md, monthEnd, pad, parseDate, ymd } from "./format"

export type BillStatus = "paid" | "due" | "unpaid" | "partial"

export interface Bill {
  billed: number
  paid: number
  st: BillStatus
  dueDate: string
  outstanding: number
  overdue: number
  /** 이 청구가 대신하는 사용 기간 (선불: 납부일부터 한 달, 후불: 직전 납부일부터 한 달) */
  from: string
  to: string
}

export interface RoomView extends Room {
  building: Building
  bname: string
  list: Contract[]
  /** 이번 청구월에 청구되는 계약 */
  billing: Contract | null
  /** 현재 진행 중인 계약 */
  current: Contract | null
  occupied: boolean
  expired: boolean
  bill: Bill | null
  /** 같은 청구월에 함께 청구되는 이전 계약 (후불 퇴실 정산 등). 최신이 billing, 나머지가 여기 */
  settles: BillEntry[]
}

/** 계약 하나의 한 달 청구 */
export interface BillEntry {
  contract: Contract
  bill: Bill
}

/** 대시보드 미납·예정 목록 한 줄 */
export interface RoomBill extends BillEntry {
  room: RoomView
}

export const billOf = (c: Pick<Contract, "type" | "rent" | "fee">) =>
  c.type === "전세" ? c.fee : c.rent + c.fee

/** m 월 납부일 (말일보다 큰 납부일은 말일) */
export const dueDateOf = (c: Pick<Contract, "payDay">, m: string) =>
  `${m}-${pad(Math.min(c.payDay, Number(monthEnd(m).slice(8))))}`

const dayBefore = (s: string) => {
  const d = parseDate(s)
  d.setDate(d.getDate() - 1)
  return ymd(d)
}

/** 청구월 m 의 납부 주기 (선불: 이번 납부일부터 한 달, 후불: 지난 납부일부터 이번 납부일 전날까지) */
function cycleOf(c: Pick<Contract, "payDay" | "payMode">, m: string) {
  const pre = c.payMode !== "후불"
  return { from: dueDateOf(c, pre ? m : addMonth(m, -1)), to: dayBefore(dueDateOf(c, pre ? addMonth(m, 1) : m)) }
}

/**
 * 청구월 m 에 이 계약을 청구하는가.
 * 선불: 입주한 달부터 매달 그 달 납부일에 받는다(앞으로 한 달 치).
 * 후불: 한 달 살고 나서 받으므로 입주한 다음 달부터 받는다(퇴실 후 정산 포함).
 * 퇴실(종료)한 계약은 그 달 납부 주기가 퇴실일 전에 시작할 때만 청구한다 — 사용 기간이 없는 청구는 없다.
 * 진행 중 계약은 종료일이 지나도(묵시적 갱신) 퇴실 처리 전까지 계속 청구
 */
export function billsIn(c: Contract, m: string) {
  const first = addMonth(c.start.slice(0, 7), c.payMode === "후불" ? 1 : 0)
  if (m < first) return false
  const { from, to } = cycleOf(c, m)
  if (to < c.start) return false
  return c.status === "진행" || from <= c.end
}

/** 첫 납부일 */
export const firstDue = (c: Pick<Contract, "start" | "payDay" | "payMode">) => dueDateOf(c, addMonth(c.start.slice(0, 7), c.payMode === "후불" ? 1 : 0))

/** 청구월 m 이 대신하는 사용 기간. 계약 시작·(퇴실한 계약의) 종료일 밖은 잘라낸다 */
export function periodOf(c: Contract, m: string) {
  let { from, to } = cycleOf(c, m)
  if (from < c.start) from = c.start
  if (c.status === "종료" && to > c.end) to = c.end
  return { from, to }
}

const alerting = (b: Bill) => b.st === "unpaid" || b.st === "partial"

/** 이번 청구월의 모든 청구 (최신 계약 + 이전 계약 정산) */
export const billsOf = (r: RoomView): BillEntry[] => (r.billing && r.bill ? [{ contract: r.billing, bill: r.bill }, ...r.settles] : [])

export const isAlert = (r: RoomView) => billsOf(r).some((e) => alerting(e.bill))

export function compute(data: AppData, month: string) {
  const today = data.today
  const bOrder = new Map(data.buildings.map((b, i) => [b.id, i]))
  const bMap = new Map(data.buildings.map((b) => [b.id, b]))

  const payBy = new Map<string, number>()
  for (const p of data.payments) {
    const k = p.contractId + "|" + p.month
    payBy.set(k, (payBy.get(k) ?? 0) + p.amount)
  }
  const byRoom = new Map<string, Contract[]>()
  for (const c of data.contracts) {
    const l = byRoom.get(c.roomId) ?? []
    l.push(c)
    byRoom.set(c.roomId, l)
  }

  function statusFor(c: Contract, m: string): Bill {
    const billed = billOf(c)
    const paid = payBy.get(c.id + "|" + m) ?? 0
    const dueDate = dueDateOf(c, m)
    let st: BillStatus
    if (billed <= 0 || paid >= billed) st = "paid"
    else if (today > dueDate) st = paid > 0 ? "partial" : "unpaid"
    else st = "due"
    return {
      billed,
      paid,
      st,
      dueDate,
      outstanding: Math.max(0, billed - paid),
      overdue: st === "unpaid" || st === "partial" ? daysBetween(dueDate, today) : 0,
      ...periodOf(c, m),
    }
  }

  const rooms: RoomView[] = data.rooms
    .map((r) => {
      const list = (byRoom.get(r.id) ?? []).slice().sort((a, b) => b.start.localeCompare(a.start))
      const entries = list.filter((c) => billsIn(c, month)).map((c) => ({ contract: c, bill: statusFor(c, month) }))
      const billing = entries[0]?.contract ?? null
      const current =
        list.find((c) => c.status === "진행" && c.start <= today) ?? list.find((c) => c.status === "진행") ?? null
      const building = bMap.get(r.buildingId) ?? { id: r.buildingId, name: r.buildingId, address: "", memo: "", row: 0 }
      return {
        ...r,
        building,
        bname: building.name.replace(/건물$/, ""),
        list,
        billing,
        current,
        occupied: !!(current && current.start <= today),
        expired: !!(current && current.end < today),
        bill: entries[0]?.bill ?? null,
        settles: entries.slice(1),
      }
    })
    .sort(
      (a, b) =>
        (bOrder.get(a.buildingId) ?? 99) - (bOrder.get(b.buildingId) ?? 99) ||
        a.no.localeCompare(b.no, "ko", { numeric: true }),
    )

  const billed = rooms.filter((r) => r.bill)
  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)
  // 금액 집계는 계약별 청구 단위 (한 호실에 이전 계약 정산이 함께 있으면 둘 다 센다)
  const entries: RoomBill[] = rooms.flatMap((r) => billsOf(r).map((e) => ({ ...e, room: r })))
  const alerts = entries.filter((e) => alerting(e.bill))
  const dues = entries.filter((e) => e.bill.st === "due")
  const total = (es: RoomBill[]) => ({
    billed: sum(es, (e) => e.bill.billed),
    paid: sum(es, (e) => Math.min(e.bill.paid, e.bill.billed)),
  })

  const k = {
    ...total(entries),
    unpaid: sum(alerts, (e) => e.bill.outstanding),
    due: sum(dues, (e) => e.bill.outstanding),
    unpaidN: alerts.length,
    dueN: dues.length,
    paidN: entries.filter((e) => e.bill.st === "paid").length,
    monthlyN: billed.filter((r) => r.billing!.type !== "전세").length,
    jeonseN: billed.filter((r) => r.billing!.type === "전세").length,
    total: rooms.length,
    occN: rooms.filter((r) => r.occupied).length,
    rate: 0,
    occ: 0,
  }
  k.rate = k.billed ? Math.round((k.paid / k.billed) * 100) : 0
  k.occ = k.total ? Math.round((k.occN / k.total) * 100) : 0

  const buildings = data.buildings.map((b) => {
    const rs = rooms.filter((r) => r.buildingId === b.id)
    const { billed: bb, paid: bp } = total(entries.filter((e) => e.room.buildingId === b.id))
    const floors = Array.from(new Set(rs.map((r) => r.floor))).sort((a, c) => c - a)
    return {
      building: b,
      rooms: rs,
      billed: bb,
      paid: bp,
      rate: bb ? Math.round((bp / bb) * 100) : 0,
      monthlyN: rs.filter((r) => r.current && r.current.type !== "전세").length,
      jeonseN: rs.filter((r) => r.current?.type === "전세").length,
      vacantN: rs.filter((r) => !r.occupied).length,
      deposit: sum(rs.filter((r) => r.occupied), (r) => r.current!.deposit),
      floors: floors.map((f) => ({ floor: f, rooms: rs.filter((r) => r.floor === f) })),
    }
  })

  const expiring = rooms
    .filter((r) => r.current && daysBetween(today, r.current.end) <= 90)
    .map((r) => ({ room: r, dday: daysBetween(today, r.current!.end) }))
    .sort((a, b) => a.dday - b.dday)

  const unpaid = alerts.slice().sort((a, b) => b.bill.overdue - a.bill.overdue)
  const due = dues.slice().sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate))

  return { rooms, entries, k, buildings, expiring, unpaid, due, statusFor }
}

export type Computed = ReturnType<typeof compute>

/** 화면 색: 청구가 없어도 입주해 있으면(후불 첫 달) 납부 예정으로 본다 */
export function toneOf(r: RoomView): BillStatus | "vacant" {
  const bad = r.settles.find((e) => alerting(e.bill))
  if (bad && !(r.bill && alerting(r.bill))) return bad.bill.st
  return r.bill ? r.bill.st : r.occupied ? "due" : "vacant"
}

export const roomName = (r: RoomView) => `${r.bname} ${r.no}호`

export function statusLabel(r: RoomView) {
  const b = r.bill
  const bad = r.settles.find((e) => alerting(e.bill))
  if (bad && !(b && alerting(b))) return `정산 미납 ${bad.bill.overdue}일`
  if (!b) return r.occupied && r.current ? `${md(firstDue(r.current))} 첫 납부` : "공실"
  if (b.st === "paid") return r.billing!.type === "전세" ? "관리비 수납" : "수납완료"
  if (b.st === "due") return `${md(b.dueDate)} 예정`
  if (b.st === "unpaid") return `미납 ${b.overdue}일`
  return "일부 미납"
}

export const BILL_LABEL: Record<BillStatus, string> = {
  paid: "수납완료",
  due: "납부예정",
  unpaid: "미납",
  partial: "일부 미납",
}
