import { describe, expect, it } from "vitest"
import { addMonth, man, monthEnd, won } from "./format"

describe("format", () => {
  it("won: 천 단위 구분 + 원", () => {
    expect(won(1234567)).toBe("1,234,567원")
    expect(won(Number.NaN)).toBe("0원")
  })

  it("man: 억·만 단위로 짧게", () => {
    expect(man(450_000)).toBe("45만원")
    expect(man(120_000_000)).toBe("1억 2,000만원")
    expect(man(100_000_000)).toBe("1억원")
    expect(man(12_345)).toBe("12,345원")
  })

  it("addMonth: 연도를 넘긴다", () => {
    expect(addMonth("2026-12", 1)).toBe("2027-01")
    expect(addMonth("2026-01", -1)).toBe("2025-12")
  })

  it("monthEnd: 윤년 2월 말일", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29")
    expect(monthEnd("2026-02")).toBe("2026-02-28")
  })

})
