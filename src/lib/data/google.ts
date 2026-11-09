import "server-only"

/**
 * 구글 시트 REST API 클라이언트 (서비스 계정).
 * 외부 라이브러리 없이 Web Crypto 로 JWT 를 서명하므로 Node·Edge·Workers 어디서나 동작합니다.
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const API = "https://sheets.googleapis.com/v4/spreadsheets"

let cached: { token: string; exp: number } | null = null

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function pemToDer(pem: string) {
  const body = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

export function sheetsConfig() {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY
  if (!sheetId || !email || !key) return null
  return { sheetId, email, key }
}

async function accessToken() {
  const cfg = sheetsConfig()
  if (!cfg) throw new Error("구글 시트 환경변수(GOOGLE_SHEET_ID 등)가 설정되지 않았습니다.")
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.exp - 60 > now) return cached.token

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(
    JSON.stringify({ iss: cfg.email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  )
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(cfg.key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`))
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`구글 인증 실패 (${res.status}). 서비스 계정 키를 확인하세요.`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: json.access_token, exp: now + json.expires_in }
  return json.access_token
}

/** 구글 시트 API 오류. status·body 로 원인을 구분할 수 있다 */
export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message)
  }
}

export async function sheetsFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = sheetsConfig()!
  const res = await fetch(`${API}/${cfg.sheetId}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403) throw new SheetsError("시트 접근 권한이 없습니다. 시트를 서비스 계정 이메일과 편집자로 공유했는지 확인하세요.", 403, text)
    if (res.status === 404) throw new SheetsError("시트를 찾을 수 없습니다. GOOGLE_SHEET_ID 를 확인하세요.", 404, text)
    throw new SheetsError(`구글 시트 오류 (${res.status}): ${text.slice(0, 200)}`, res.status, text)
  }
  return (await res.json()) as T
}

export const range = (sheet: string, a1 = "") => encodeURIComponent(`'${sheet}'${a1 ? "!" + a1 : ""}`)

export function sheetUrl() {
  const cfg = sheetsConfig()
  return cfg ? `https://docs.google.com/spreadsheets/d/${cfg.sheetId}/edit` : null
}
