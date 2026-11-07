import "server-only"
import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySessionToken } from "./auth"

/** 서버 액션·데이터 로딩 시 다시 확인 (proxy 는 1차 확인용) */
export async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!(await verifySessionToken(token))) throw new Error("로그인이 필요합니다. 페이지를 새로고침하세요.")
}
