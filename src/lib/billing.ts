import type { AppData, Building, Contract, Room } from "./types"
import { daysBetween, monthEnd, pad } from "./format"

export type BillStatus = "paid" | "due" | "unpaid" | "partial"

export interface Bill {
  billed: number
  paid: number
  st: BillStatus
  dueDate: string
  outstanding: number
  overdue: number
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
}

export const billOf = (c: Pick<Contract, "type" | "rent" | "fee">) =>
  c.type === "전세" ? c.fee : c.rent + c.fee

export const isAlert = (r: RoomView) => r.bill?.st === "unpaid" || r.bill?.st === "partial"

export function compute(data: AppData, month: string) {
  const today = data.today
  const mStart = month + "-01"
  const mEnd = monthEnd(month)
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
    const me = monthEnd(m)
    const dueDate = `${m}-${pad(Math.min(c.payDay, Number(me.slice(8))))}`
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
    }
  }

  const rooms: RoomView[] = data.rooms
    .map((r) => {
      const list = (byRoom.get(r.id) ?? []).slice().sort((a, b) => b.start.localeCompare(a.start))
      // 진행 중 계약은 종료일이 지나도(묵시적 갱신) 퇴실 처리 전까지 계속 청구
      const billing = list.find((c) => c.start <= mEnd && (c.status === "진행" || c.end >= mStart)) ?? null
      const current =
        list.find((c) => c.status === "진행" && c.start <= today) ?? list.find((c) => c.status === "진행") ?? null
      const building = bMap.get(r.buildingId) ?? { id: r.buildingId, name: r.buildingId, address: "", memo: "" }
      return {
        ...r,
        building,
        bname: building.name.replace(/건물$/, ""),
        list,
        billing,
        current,
        occupied: !!(current && current.start <= today),
        expired: !!(current && current.end < today),
        bill: billing ? statusFor(billing, month) : null,
      }
    })
    .sort(
      (a, b) =>
        (bOrder.get(a.buildingId) ?? 99) - (bOrder.get(b.buildingId) ?? 99) ||
        a.no.localeCompare(b.no, "ko", { numeric: true }),
    )

  const billed = rooms.filter((r) => r.bill)
  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)
  const alerts = billed.filter(isAlert)
  const dues = billed.filter((r) => r.bill!.st === "due")

  const k = {
    billed: sum(billed, (r) => r.bill!.billed),
    paid: sum(billed, (r) => Math.min(r.bill!.paid, r.bill!.billed)),
    unpaid: sum(alerts, (r) => r.bill!.outstanding),
    due: sum(dues, (r) => r.bill!.outstanding),
    unpaidN: alerts.length,
    dueN: dues.length,
    paidN: billed.filter((r) => r.bill!.st === "paid").length,
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
    const bl = rs.filter((r) => r.bill)
    const bb = sum(bl, (r) => r.bill!.billed)
    const bp = sum(bl, (r) => Math.min(r.bill!.paid, r.bill!.billed))
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

  const unpaid = alerts.slice().sort((a, b) => b.bill!.overdue - a.bill!.overdue)
  const due = dues.slice().sort((a, b) => a.bill!.dueDate.localeCompare(b.bill!.dueDate))

  return { rooms, k, buildings, expiring, unpaid, due, statusFor }
}

export type Computed = ReturnType<typeof compute>

export const roomName = (r: RoomView) => `${r.bname} ${r.no}호`

export function statusLabel(r: RoomView) {
  const b = r.bill
  if (!b) return "공실"
  if (b.st === "paid") return r.billing!.type === "전세" ? "관리비 수납" : "수납완료"
  if (b.st === "due") return `${Number(b.dueDate.slice(5, 7))}/${Number(b.dueDate.slice(8))} 예정`
  if (b.st === "unpaid") return `미납 ${b.overdue}일`
  return "일부 미납"
}

export const BILL_LABEL: Record<BillStatus, string> = {
  paid: "수납완료",
  due: "납부예정",
  unpaid: "미납",
  partial: "일부 미납",
}
