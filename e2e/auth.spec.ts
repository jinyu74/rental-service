import { expect, test } from "@playwright/test"
import { login } from "./helpers"

test("로그인하지 않으면 로그인 화면으로 보낸다", async ({ page }) => {
  await page.goto("/units")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator("#pw")).toBeVisible()
})

test("비밀번호가 틀리면 오류를 보여 준다", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#pw").fill("wrong-password")
  await page.getByRole("button", { name: "들어가기" }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("로그인하면 원래 가려던 화면으로, 로그아웃하면 다시 로그인 화면", async ({ page }) => {
  await login(page, "/expenses")
  await expect(page).toHaveURL(/\/expenses(\?|$)/)
  await page.getByRole("button", { name: "로그아웃" }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
})
