import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// 순수 계산 로직(청구·보증금·수입지출·시트 값 정규화) 단위 테스트. 구글 시트·네트워크는 쓰지 않는다
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { TZ: "Asia/Seoul" },
  },
})
