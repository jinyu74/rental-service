import { describe, expect, it } from "vitest"
import { mapContract, mapDeposit, normDate, num, toObjects } from "./normalize"

describe("시트 값 정규화", () => {
  it("normDate: 여러 날짜 표기와 시트 일련번호를 YYYY-MM-DD 로", () => {
    expect(normDate("2026. 11. 6")).toBe("2026-11-06")
    expect(normDate("2026/3/5")).toBe("2026-03-05")
    expect(normDate(46000)).toBe("2025-12-09")
  })

  it("num: 쉼표·원 표시를 걷어낸다", () => {
    expect(num("550,000원")).toBe(550000)
    expect(num("")).toBe(0)
  })

  it("toObjects: 머리글로 객체를 만들고 행 번호를 붙이며 ID 가 빈 행은 버린다", () => {
    const rows = toObjects([["계약ID", "임차인"], ["C1", "가"], ["", "빈 행"], ["C2", "나"]])
    expect(rows.map((r) => [r["계약ID"], r._row])).toEqual([["C1", 2], ["C2", 4]])
  })

  it("mapContract: 납부방식은 「후불」일 때만 후불, 빈칸은 선불", () => {
    const [post, blank] = toObjects([["계약ID", "납부방식", "납부일"], ["C1", "후불", ""], ["C2", "", "10"]]).map(mapContract)
    expect(post.payMode).toBe("후불")
    expect(post.payDay).toBe(1) // 빈 납부일은 1일
    expect(blank.payMode).toBe("선불")
    expect(blank.payDay).toBe(10)
  })

  it("mapDeposit: 금액은 양수, 모르는 구분은 잔금", () => {
    const [d] = toObjects([["보증금ID", "구분", "금액"], ["D1", "?", "-1,000"]]).map(mapDeposit)
    expect(d.kind).toBe("잔금")
    expect(d.amount).toBe(1000)
  })
})
