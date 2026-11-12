import { expect, test } from "@playwright/test"
import { collectErrors, login } from "./helpers"

test("대시보드: 지표와 건물별 현황판", async ({ page }) => {
  const errors = collectErrors(page)
  await login(page)
  await expect(page.getByRole("heading", { name: /월 임대 현황/ })).toBeVisible()
  for (const k of ["수납 완료", "순수익", "미수금", "입주율"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/공실 \d+실 \/ 전체 \d+실/).first()).toBeVisible()
  await expect(page.getByText("Building A").first()).toBeVisible()
  await expect(page.getByText("Building B").first()).toBeVisible()
  expect(errors).toEqual([])
})

test("주 메뉴로 화면 이동", async ({ page }) => {
  await login(page)
  const nav = page.getByRole("navigation", { name: "주 메뉴" })
  await nav.getByRole("link", { name: "호실·계약" }).click()
  await expect(page).toHaveURL(/\/units(\?|$)/)
  await nav.getByRole("link", { name: "수납 내역" }).click()
  await expect(page).toHaveURL(/\/payments(\?|$)/)
  await nav.getByRole("link", { name: "지출" }).click()
  await expect(page).toHaveURL(/\/expenses(\?|$)/)
})

test.describe("휴대폰 화면", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test("하단 메뉴가 보이고 가로 스크롤이 없다", async ({ page }) => {
    await login(page)
    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "주 메뉴" })).toBeHidden()
    for (const path of ["/", "/units", "/payments", "/expenses"]) {
      await page.goto(path)
      await expect(page.getByText("미리보기 데이터").first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
  })
})
