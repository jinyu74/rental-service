import { describe, expect, it } from "vitest"
import { appData, contract, payment } from "@/test/fixtures"
import { billOf, billsIn, compute, dueDateOf, periodOf, statusLabel } from "./billing"

const pre = contract({ payMode: "선불" })
const post = contract({ payMode: "후불" })

describe("청구 금액·납부일", () => {
  it("월세는 임대료+관리비, 전세는 관리비만", () => {
    expect(billOf(pre)).toBe(550_000)
    expect(billOf(contract({ type: "전세", rent: 0 }))).toBe(50_000)
  })

  it("말일보다 큰 납부일은 그 달 말일", () => {
    expect(dueDateOf({ payDay: 31 }, "2026-02")).toBe("2026-02-28")
    expect(dueDateOf({ payDay: 31 }, "2026-04")).toBe("2026-04-30")
  })
})

describe("선불/후불 청구월", () => {
  it("선불은 입주한 달부터, 후불은 다음 달부터 청구", () => {
    expect([billsIn(pre, "2026-02"), billsIn(pre, "2026-03")]).toEqual([false, true])
    expect([billsIn(post, "2026-03"), billsIn(post, "2026-04")]).toEqual([false, true])
  })

  it("사용 기간: 선불은 앞으로 한 달, 후불은 지난 한 달", () => {
    expect(periodOf(pre, "2026-03")).toEqual({ from: "2026-03-15", to: "2026-04-14" })
    expect(periodOf(post, "2026-04")).toEqual({ from: "2026-03-15", to: "2026-04-14" })
  })

  it("후불 퇴실: 다음 달 정산 청구는 퇴실일까지로 자르고, 그 뒤로는 청구 없음", () => {
    const ended = { ...post, status: "종료" as const, end: "2026-06-20" }
    expect(billsIn(ended, "2026-07")).toBe(true)
    expect(periodOf(ended, "2026-07")).toEqual({ from: "2026-06-15", to: "2026-06-20" })
    expect(billsIn(ended, "2026-08")).toBe(false)
  })

  it("선불: 납부일 전에 퇴실한 달은 청구하지 않는다", () => {
    expect(billsIn({ ...pre, status: "종료", end: "2026-06-10" }, "2026-06")).toBe(false)
    expect(billsIn({ ...pre, status: "종료", end: "2026-06-20" }, "2026-06")).toBe(true)
  })

  it("진행 중 계약은 종료일이 지나도(묵시적 갱신) 계속 청구", () => {
    expect(billsIn(pre, "2027-06")).toBe(true)
  })

  it("윤년 말일 납부 후불 한 달 계약", () => {
    const leap = contract({ payMode: "후불", payDay: 31, start: "2028-01-31", end: "2028-02-28", status: "종료" })
    expect(periodOf(leap, "2028-02")).toEqual({ from: "2028-01-31", to: "2028-02-28" })
    expect(billsIn(leap, "2028-03")).toBe(false)
  })
})

describe("compute: 수납 상태와 집계", () => {
  it("납부일 전은 예정, 지나면 미납, 일부 입금은 일부 미납, 다 내면 수납완료", () => {
    const st = (today: string, paid?: number) =>
      compute(appData({ today, contracts: [pre], payments: paid ? [payment({ contractId: "C1", month: "2026-03", amount: paid })] : [] }), "2026-03")
        .rooms[0].bill?.st
    expect(st("2026-03-10")).toBe("due")
    expect(st("2026-03-20")).toBe("unpaid")
    expect(st("2026-03-20", 100_000)).toBe("partial")
    expect(st("2026-03-20", 550_000)).toBe("paid")
  })

  it("미납 일수와 라벨", () => {
    const M = compute(appData({ today: "2026-03-20", contracts: [pre] }), "2026-03")
    expect(M.rooms[0].bill?.overdue).toBe(5)
    expect(statusLabel(M.rooms[0])).toBe("미납 5일")
  })

  it("후불 입주 달: 청구는 없지만 입주 중이며 첫 납부일을 보여 준다", () => {
    const M = compute(appData({ contracts: [post] }), "2026-03")
    expect(M.rooms[0].bill).toBeNull()
    expect(M.rooms[0].occupied).toBe(true)
    expect(statusLabel(M.rooms[0])).toBe("4/15 첫 납부")
    expect(M.k.billed).toBe(0)
  })

  it("이전 후불 계약 정산과 새 계약을 함께 집계", () => {
    const oldC = contract({ id: "OLD", payMode: "후불", payDay: 1, start: "2026-10-01", end: "2026-10-31", status: "종료", rent: 100, fee: 0 })
    const newC = contract({ id: "NEW", payDay: 1, start: "2026-11-01", end: "2027-10-31", rent: 100, fee: 0 })
    const M = compute(
      appData({ today: "2026-11-20", contracts: [oldC, newC], payments: [payment({ contractId: "NEW", month: "2026-11", amount: 100 })] }),
      "2026-11",
    )
    expect([M.k.billed, M.k.unpaid, M.k.rate]).toEqual([200, 100, 50])
    expect(M.unpaid.map((e) => e.contract.id)).toEqual(["OLD"])
    expect(M.rooms[0].billing?.id).toBe("NEW")
    expect(statusLabel(M.rooms[0])).toBe("정산 미납 19일")
    expect(M.buildings[0].billed).toBe(200)
  })

  it("초과 입금은 수납률 100% 를 넘기지 않는다", () => {
    const M = compute(appData({ today: "2026-03-20", contracts: [pre], payments: [payment({ contractId: "C1", month: "2026-03", amount: 900_000 })] }), "2026-03")
    expect([M.k.paid, M.k.rate]).toEqual([550_000, 100])
  })

  it("계약 만료 90일 이내 목록", () => {
    const M = compute(appData({ today: "2027-01-01", contracts: [pre] }), "2027-01")
    expect(M.expiring.map((e) => e.dday)).toEqual([72])
  })
})
