import { expect, type Page } from "@playwright/test"
import { E2E_PASSWORD } from "../playwright.config"

/** 로그인하고, 실제 시트가 아니라 미리보기(가짜) 데이터인지 확인한 뒤에만 진행 */
export async function login(page: Page, path = "/") {
  await page.goto(path)
  await page.locator("#pw").fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "들어가기" }).click()
  await expect(page.getByText("미리보기 데이터").first()).toBeVisible()
}

/** 페이지에서 난 자바스크립트 오류를 모은다 */
export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  return errors
}

export const dialog = (page: Page) => page.getByRole("dialog")
