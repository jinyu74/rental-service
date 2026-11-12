import { expect, test } from "@playwright/test"
import { login } from "./helpers"

const won = (s: string | null) => Number((s ?? "").replace(/[^0-9]/g, ""))

test("빠른 지출: 태그를 누르면 바로 기록되고 되돌리기로 취소", async ({ page }) => {
  await login(page, "/expenses")
  const card = page.locator("[data-slot=card]").filter({ has: page.locator("[data-slot=card-title]", { hasText: /^Building A$/ }) })
  // 「N월 지출 합계」 지표 카드의 금액
  const total = page.locator("[data-slot=card]:has(> span:has-text('지출 합계')) > span").nth(1)
  const before = won(await total.textContent())

  await card.getByRole("button", { name: "소모품 30,000원 바로 기록" }).click()
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "소모품 30,000원" })
  await expect(toast).toBeVisible()
  await expect.poll(async () => won(await total.textContent())).toBe(before + 30000)

  await toast.getByRole("button", { name: "되돌리기" }).click()
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "되돌렸습니다" })).toBeVisible()
  await expect.poll(async () => won(await total.textContent())).toBe(before)
})
