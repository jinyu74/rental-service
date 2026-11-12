import { expect, test } from "@playwright/test"
import { dialog, login } from "./helpers"

// 이번 달 아직 다 내지 않은(미납·예정) 계약 아무거나. 재시도 때 앞선 시도가 남긴 입금이 있어도 다른 호실을 고른다
test("수납 기록 → 수납완료, 기록 삭제 → 원래 상태", async ({ page }, info) => {
  const memo = `e2e 입금 ${info.repeatEachIndex}${info.retry}`
  await login(page, "/units")
  const open = page.locator("table tbody tr").filter({ has: page.locator("td:last-child", { hasText: /^(미납 \d+일|\d+\/\d+ 예정)$/ }) }).first()
  await expect(open).toBeVisible()
  const tenant = (await open.locator("td").nth(1).locator("div").first().textContent())!.trim()
  const row = page.locator("table tbody tr").filter({ hasText: tenant })
  const before = (await row.locator("td").last().textContent())!.trim()

  await row.click()
  const aside = page.locator("aside").first()
  await aside.getByRole("button", { name: /^수납 기록 \(/ }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator("#pay-a")).not.toHaveValue("")
  await page.locator("#pay-memo").fill(memo)
  await dialog(page).getByRole("button", { name: "저장하고 시트에 기록" }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(row).toContainText("수납완료")

  // 수납 내역 화면에서 같은 기록을 지운다
  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "수납 내역" }).click()
  // 수납 목록의 한 줄 (같은 기록이 숨겨진 호실 상세 패널에도 있으므로 보이는 것만)
  const rec = page.locator("main div.flex.items-center.gap-3.py-3").filter({ hasText: memo, visible: true })
  await expect(rec).toHaveCount(1)
  await rec.getByRole("button", { name: /기록 삭제$/ }).filter({ visible: true }).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).locator("button[type=submit], button:has-text('삭제')").last().click()
  await expect(dialog(page)).toBeHidden()
  await expect(rec).toHaveCount(0)

  await page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name: "호실·계약" }).click()
  await expect(row.locator("td").last()).toHaveText(before)
})
