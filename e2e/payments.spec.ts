import { expect, test } from "@playwright/test"
import { dialog, login } from "./helpers"

// 가짜 데이터에서 「최유진」은 이번 달 입금 기록이 없는 계약
test("수납 기록 → 수납완료, 기록 삭제 → 원래 상태", async ({ page }) => {
  await login(page, "/units")
  const row = page.locator("table tbody tr").filter({ hasText: "최유진" })
  await expect(row).not.toContainText("수납완료")
  const before = (await row.locator("td").last().textContent())!.trim()

  await row.click()
  const aside = page.locator("aside").first()
  await aside.getByRole("button", { name: /^수납 기록 \(/ }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator("#pay-a")).not.toHaveValue("")
  await page.locator("#pay-memo").fill("e2e 입금")
  await dialog(page).getByRole("button", { name: "저장하고 시트에 기록" }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(row).toContainText("수납완료")

  // 수납 내역 화면에서 같은 기록을 지운다
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "수납 내역" }).click()
  // 수납 목록의 한 줄 (같은 기록이 숨겨진 호실 상세 패널에도 있으므로 보이는 것만)
  const rec = page.locator("main div.flex.items-center.gap-3.py-3").filter({ hasText: "e2e 입금", visible: true })
  await expect(rec).toHaveCount(1)
  await rec.getByRole("button", { name: /기록 삭제$/ }).filter({ visible: true }).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).locator("button[type=submit], button:has-text('삭제')").last().click()
  await expect(dialog(page)).toBeHidden()
  await expect(rec).toHaveCount(0)

  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "호실·계약" }).click()
  await expect(page.locator("table tbody tr").filter({ hasText: "최유진" }).locator("td").last()).toHaveText(before)
})
