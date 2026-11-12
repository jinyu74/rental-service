import { describe, expect, it } from "vitest"
import { appData, contract, deposit, expense, payment, room } from "@/test/fixtures"
import { depositAlerts, depositOf, depositReturnsDue, fixedStatus, monthFinance } from "./finance"

describe("보증금", () => {
  it("입금 합계에 따라 미입금 → 일부 → 완납", () => {
    const c = contract()
    expect(depositOf(c, []).st).toBe("unpaid")
    expect(depositOf(c, [deposit({ kind: "계약금", amount: 1_000_000 })])).toMatchObject({ st: "partial", remaining: 9_000_000 })
    expect(depositOf(c, [deposit({ kind: "계약금", amount: 1_000_000 }), deposit({ kind: "잔금", amount: 9_000_000 })]).st).toBe("full")
  })

  it("반환 기록이 있으면 반환 중 / 반환 완료", () => {
    const paid = [deposit({ kind: "잔금", amount: 10_000_000 })]
    expect(depositOf(contract(), [...paid, deposit({ kind: "반환", amount: 4_000_000 })])).toMatchObject({ st: "returning", held: 6_000_000 })
    expect(depositOf(contract(), [...paid, deposit({ kind: "반환", amount: 10_000_000 })]).st).toBe("returned")
  })

  it("미입금 알림은 입주 60일 이내 진행 계약만", () => {
    const recent = contract({ id: "NEW", start: "2026-03-01" })
    const old = contract({ id: "OLD", start: "2025-01-01" })
    expect(depositAlerts(appData({ today: "2026-03-20", contracts: [recent, old] })).map((d) => d.contract.id)).toEqual(["NEW"])
  })

  it("퇴실했는데 돌려주지 않은 보증금", () => {
    const ended = contract({ status: "종료" })
    expect(depositReturnsDue(appData({ contracts: [ended], deposits: [deposit({ kind: "잔금", amount: 10_000_000 })] }))).toHaveLength(1)
  })
})

describe("수입·지출", () => {
  it("순수익 = 청구월 입금 − 귀속월 지출, 건물별로 나눌 수 있다", () => {
    const data = appData({
      rooms: [room(), room({ id: "B-101", buildingId: "B" })],
      payments: [payment({ contractId: "C1", month: "2026-03", amount: 550_000 }), payment({ contractId: "C2", roomId: "B-101", month: "2026-03", amount: 600_000 })],
      expenses: [expense({ month: "2026-03", amount: 100_000, fixedId: "FX-1" }), expense({ month: "2026-03", amount: 30_000 }), expense({ month: "2026-02", amount: 999 })],
    })
    expect(monthFinance(data, "2026-03", 1_200_000)).toMatchObject({ income: 1_150_000, expense: 130_000, fixedExpense: 100_000, otherExpense: 30_000, net: 1_020_000, expectedNet: 1_070_000 })
    expect(monthFinance(data, "2026-03", 0, "B")).toMatchObject({ income: 600_000, expense: 0 })
  })

  it("정기 지출 추천 금액은 가장 최근 기록, 없으면 기본 금액", () => {
    const f = { id: "FX-1", buildingId: "A", item: "청소", amount: 150_000, memo: "", row: 2 }
    const data = appData({ fixedCosts: [f], expenses: [expense({ month: "2026-01", amount: 160_000, fixedId: "FX-1" })] })
    expect(fixedStatus(data, "A", "2026-03")[0]).toMatchObject({ suggest: 160_000, lastMonth: "2026-01", done: undefined })
    expect(fixedStatus(appData({ fixedCosts: [f] }), "A", "2026-03")[0].suggest).toBe(150_000)
  })
})
