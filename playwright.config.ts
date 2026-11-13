import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
export const E2E_PASSWORD = "e2e-password"

/**
 * 브라우저 e2e. 빌드 결과(`pnpm build`)를 미리보기(가짜) 데이터로 띄워서 화면을 실제로 조작한다.
 * 구글 시트 변수를 빈 값으로 덮어써서 .env.local 이 있어도 실제 시트에 연결되지 않게 한다
 * (Next 는 이미 있는 환경변수를 .env 파일로 덮지 않는다). 각 테스트는 로그인 직후 「미리보기 데이터」 표시를 확인한다.
 */
export default defineConfig({
  testDir: "e2e",
  // 가짜 데이터는 서버 메모리 하나를 같이 쓰므로 순서대로 실행
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    // 같은 포트에 떠 있는 다른 서버(실제 시트에 연결됐을 수 있음)를 재사용하지 않는다
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      GOOGLE_SHEET_ID: "",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: "",
      AUTH_PASSWORD: E2E_PASSWORD,
      AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
      TZ: "Asia/Seoul",
    },
  },
})
