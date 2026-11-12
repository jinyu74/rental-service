import { expect, test } from "@playwright/test"
import { dialog, login } from "./helpers"

const rows = (page: import("@playwright/test").Page) => page.locator("table tbody tr")

test("임차인 검색과 건물 필터", async ({ page }) => {
  await login(page, "/units")
  await expect(rows(page)).toHaveCount(32)
  await page.getByPlaceholder("임차인, 호실, 연락처 검색").fill("김민준")
  await expect(rows(page)).toHaveCount(1)
  await page.getByPlaceholder("임차인, 호실, 연락처 검색").fill("")
  await page.getByRole("group", { name: "건물" }).getByRole("button", { name: /Building B/ }).click()
  await expect(rows(page)).toHaveCount(19)
  await expect(rows(page).filter({ hasText: "Building A" })).toHaveCount(0)
})

test("호실을 누르면 상세에 계약 조건이 보인다", async ({ page }) => {
  await login(page, "/units")
  await rows(page).filter({ hasText: "김민준" }).click()
  const aside = page.locator("aside").first()
  await expect(aside).toContainText("김민준")
  await expect(aside).toContainText(/매월 \d+일 (선불|후불)/)
  await expect(aside.getByRole("button", { name: "계약 종료(퇴실)" })).toBeVisible()
})

test("공실에 후불 계약을 등록하면 이번 달은 「첫 납부」 예정으로 보인다", async ({ page }) => {
  await login(page, "/units")
  const vacant = rows(page).filter({ hasText: "입주자 모집 중" }).filter({ hasText: "Building A" }).first()
  await vacant.click()
  await page.locator("aside").first().getByRole("button", { name: /이 호실에 새 계약 등록/ }).click()
  await expect(dialog(page)).toBeVisible()
  const today = await page.evaluate(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })
  await page.locator("#ct-t").fill("이투이")
  await page.locator("#ct-p").fill("010-0000-1234")
  await page.locator("#ct-s").fill(today)
  await dialog(page).getByRole("button", { name: /후불 \(한 달/ }).click()
  await dialog(page).locator("button[type=submit]").click()
  await expect(dialog(page)).toBeHidden()
  const row = rows(page).filter({ hasText: "이투이" })
  await expect(row).toContainText("첫 납부")
  await expect(row).not.toContainText("공실")
})
