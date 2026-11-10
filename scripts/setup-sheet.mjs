// 구글 시트 초기 설정: node scripts/setup-sheet.mjs   (pnpm setup-sheet)
// - 「건물·호실·계약·수납내역·보증금내역·지출내역·정기지출」 탭과 머리글을 만들고, 날짜·ID 열을 텍스트 형식으로 지정
// - 유형(월세/전세)·상태(진행/종료)·보증금 구분(계약금/잔금/반환) 드롭다운 추가, 시간대를 Asia/Seoul 로 설정
// - 건물·호실 탭이 비어 있으면 춘천 13실·시흥 19실(예시 호수)을 넣음
// 이미 있는 데이터는 지우지 않습니다. 여러 번 실행해도 안전합니다.
import { existsSync } from "node:fs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const { GOOGLE_SHEET_ID: ID, GOOGLE_SERVICE_ACCOUNT_EMAIL: EMAIL, GOOGLE_PRIVATE_KEY: KEY } = process.env
if (!ID || !EMAIL || !KEY) {
  console.error("✗ .env.local 에 GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY 를 채우세요.")
  process.exit(1)
}

const SHEETS = {
  buildings: { name: "건물", headers: ["건물ID", "건물명", "주소", "메모"], text: ["건물ID"] },
  rooms: { name: "호실", headers: ["호실ID", "건물ID", "호수", "층", "면적(㎡)", "메모"], text: ["호실ID", "건물ID", "호수"] },
  contracts: {
    name: "계약",
    headers: ["계약ID", "호실ID", "임차인", "연락처", "유형", "보증금", "월임대료", "관리비", "납부일", "시작일", "종료일", "상태", "메모", "등록일시"],
    text: ["계약ID", "호실ID", "연락처", "시작일", "종료일"],
  },
  payments: {
    name: "수납내역",
    headers: ["수납ID", "계약ID", "호실ID", "청구월", "입금액", "입금일", "방법", "메모", "기록일시"],
    text: ["수납ID", "계약ID", "호실ID", "청구월", "입금일"],
  },
  deposits: {
    name: "보증금내역",
    headers: ["보증금ID", "계약ID", "호실ID", "구분", "금액", "일자", "방법", "메모", "기록일시"],
    text: ["보증금ID", "계약ID", "호실ID", "일자"],
  },
  expenses: {
    name: "지출내역",
    headers: ["지출ID", "건물ID", "귀속월", "항목", "금액", "지출일", "메모", "정기항목ID", "기록일시"],
    text: ["지출ID", "건물ID", "귀속월", "지출일", "정기항목ID"],
  },
  fixedCosts: { name: "정기지출", headers: ["정기항목ID", "건물ID", "항목", "기본금액", "메모"], text: ["정기항목ID", "건물ID"] },
}
const LAYOUT = [
  ["CC", "춘천건물", { 1: 3, 2: 5, 3: 5 }],
  ["SH", "시흥건물", { 1: 4, 2: 5, 3: 5, 4: 5 }],
]

const b64url = (b) => Buffer.from(b).toString("base64url")
async function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(JSON.stringify({ iss: EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))
  const { createSign } = await import("node:crypto")
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(KEY.replace(/\\n/g, "\n"), "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
  })
  if (!res.ok) throw new Error("구글 인증 실패: " + (await res.text()))
  return (await res.json()).access_token
}

const T = await token()
async function api(path, init = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${T}`, "content-type": "application/json" },
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error(`시트 권한 없음. 시트를 ${EMAIL} 와 편집자로 공유하세요.`)
    throw new Error(`시트 API 오류 ${res.status}: ${await res.text()}`)
  }
  return res.json()
}
const rng = (sheet, a1) => encodeURIComponent(`'${sheet}'!${a1}`)

// 1) 탭 만들기 + 시간대
let meta = await api("?fields=sheets.properties(sheetId,title)")
const titles = meta.sheets.map((s) => s.properties.title)
const add = Object.values(SHEETS).filter((s) => !titles.includes(s.name))
await api(":batchUpdate", {
  method: "POST",
  body: JSON.stringify({
    requests: [
      { updateSpreadsheetProperties: { properties: { timeZone: "Asia/Seoul" }, fields: "timeZone" } },
      ...add.map((s) => ({ addSheet: { properties: { title: s.name } } })),
    ],
  }),
})
if (add.length) console.log("✓ 탭 추가:", add.map((s) => s.name).join(", "))
meta = await api("?fields=sheets.properties(sheetId,title)")
const sid = (name) => meta.sheets.find((s) => s.properties.title === name).properties.sheetId

// 2) 머리글·형식·드롭다운
const requests = []
for (const s of Object.values(SHEETS)) {
  await api(`/values/${rng(s.name, "A1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [s.headers] }) })
  const id = sid(s.name)
  requests.push(
    { repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.95, green: 0.96, blue: 0.97 } } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
    { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    ...s.text.map((h) => {
      const c = s.headers.indexOf(h)
      return { repeatCell: { range: { sheetId: id, startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } }, fields: "userEnteredFormat.numberFormat" } }
    }),
  )
}
const list = (header, values, sheet = SHEETS.contracts) => {
  const c = sheet.headers.indexOf(header)
  return { setDataValidation: { range: { sheetId: sid(sheet.name), startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: values.map((v) => ({ userEnteredValue: v })) }, strict: true, showCustomUi: true } } }
}
requests.push(list("유형", ["월세", "전세"]), list("상태", ["진행", "종료"]), list("구분", ["계약금", "잔금", "반환"], SHEETS.deposits))
await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) })
console.log("✓ 머리글·텍스트 형식·드롭다운 설정")

// 3) 건물·호실 기본값 (비어 있을 때만)
const filled = async (name) => ((await api(`/values/${rng(name, "A2:A3")}`)).values ?? []).length > 0
if (!(await filled("건물"))) {
  await api(`/values/${rng("건물", "A2")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: LAYOUT.map(([id, name]) => [id, name, "", ""]) }) })
  console.log("✓ 건물 2개 추가")
}
if (!(await filled("호실"))) {
  const rows = []
  for (const [b, , floors] of LAYOUT)
    for (const [f, n] of Object.entries(floors))
      for (let i = 1; i <= n; i++) {
        const no = f + String(i).padStart(2, "0")
        rows.push([`${b}-${no}`, b, no, Number(f), "", ""])
      }
  await api(`/values/${rng("호실", "A2")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: rows }) })
  console.log(`✓ 호실 ${rows.length}개 추가 (예시 호수 — 실제와 다르면 「호실」 탭에서 수정)`)
}
console.log("완료: https://docs.google.com/spreadsheets/d/" + ID + "/edit")
