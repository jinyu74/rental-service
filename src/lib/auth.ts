/**
 * 간단한 비밀번호 로그인. 서명된 쿠키(HMAC-SHA256)로 세션을 유지합니다.
 * Web Crypto 만 사용하므로 proxy(엣지)와 서버 양쪽에서 동작합니다.
 */
export const SESSION_COOKIE = "rent_session"
export const SESSION_DAYS = 30

const enc = new TextEncoder()

export function authConfig() {
  const password = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET || password
  return { password, secret, disabled: !password && process.env.NODE_ENV !== "production" }
}

async function hmac(data: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("")
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function createSessionToken() {
  const { secret } = authConfig()
  if (!secret) throw new Error("AUTH_PASSWORD 가 설정되지 않았습니다.")
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  return `${exp}.${await hmac(String(exp), secret)}`
}

export async function verifySessionToken(token: string | undefined) {
  const { secret, disabled } = authConfig()
  if (disabled) return true
  if (!token || !secret) return false
  const [exp, sig] = token.split(".")
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmac(exp, secret))
}

export async function checkPassword(input: string) {
  const { password } = authConfig()
  if (!password) return false
  // 길이 차이로 인한 타이밍 노출을 줄이기 위해 해시끼리 비교
  return safeEqual(await hmac(input, "pw"), await hmac(password, "pw"))
}
