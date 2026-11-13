import { expect, test } from "@playwright/test"
import { dialog, login } from "./helpers"

const rows = (page: import("@playwright/test").Page) => page.locator("table tbody tr")

test("임차인 검색과 건물 필터", async ({ page }) => {
  await login(page, "/units")
  await expect(rows(page).first()).toBeVisible()
  await page.getByPlaceholder("임차인, 호실, 연락처 검색").fill("김민준")
  await expect(rows(page)).toHaveCount(1)
  await page.getByPlaceholder("임차인, 호실, 연락처 검색").fill("")
  await page.getByRole("group", { name: "건물" }).getByRole("button", { name: /Building B/ }).click()
  await expect(rows(page).filter({ hasText: "Building B" }).first()).toBeVisible()
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

// 재시도해도 앞선 시도가 남긴 상태에 기대지 않도록 시도마다 새 호실을 만들어 그 호실에 등록한다
test("새 호실에 후불 계약을 등록하면 이번 달은 「첫 납부」 예정으로 보인다", async ({ page }, info) => {
  const no = `E2E${info.repeatEachIndex}${info.retry}`
  const tenant = `이투이${info.repeatEachIndex}${info.retry}`
  await login(page, "/units")
  await page.getByRole("button", { name: "호실 추가" }).click()
  await expect(dialog(page)).toBeVisible()
  await page.locator("#rm-b").selectOption("A")
  await page.locator("#rm-no").fill(no)
  await page.locator("#rm-f").fill("9")
  await dialog(page).getByRole("button", { name: "저장" }).click()
  await expect(dialog(page)).toBeHidden()
  const vacant = rows(page).filter({ hasText: `${no}호` })
  await expect(vacant).toContainText("입주자 모집 중")
  await vacant.click()
  await page.locator("aside").first().getByRole("button", { name: /이 호실에 새 계약 등록/ }).click()
  await expect(dialog(page)).toBeVisible()
  const today = await page.evaluate(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })
  await page.locator("#ct-t").fill(tenant)
  await page.locator("#ct-p").fill("010-0000-1234")
  await page.locator("#ct-s").fill(today)
  await dialog(page).getByRole("button", { name: /후불 \(한 달/ }).click()
  await dialog(page).locator("button[type=submit]").click()
  await expect(dialog(page)).toBeHidden()
  const row = rows(page).filter({ hasText: tenant })
  await expect(row).toContainText("첫 납부")
  await expect(row).not.toContainText("공실")
})
