export const pad = (n: number) => String(n).padStart(2, "0")

export const won = (n: number) => (Number(n) || 0).toLocaleString("ko-KR") + "원"

/** 1억 2,000만원 / 45만원 처럼 짧게 */
export function man(n: number) {
  n = Number(n) || 0
  if (n >= 1e8) {
    const eok = Math.floor(n / 1e8)
    const rest = Math.round((n % 1e8) / 1e4)
    return `${eok}억${rest ? " " + rest.toLocaleString("ko-KR") + "만" : ""}원`
  }
  if (n >= 1e4 && n % 1e4 === 0) return (n / 1e4).toLocaleString("ko-KR") + "만원"
  return won(n)
}

export const digits = (v: string | number | null | undefined) =>
  Number(String(v ?? "").replace(/[^0-9]/g, "")) || 0

export const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const addMonth = (month: string, k: number) => {
  const d = parseDate(month + "-01")
  d.setMonth(d.getMonth() + k)
  return ymd(d).slice(0, 7)
}

export const monthEnd = (month: string) => {
  const d = parseDate(month + "-01")
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)

export const monthNum = (m: string) => Number(m.slice(5, 7))
export const dotDate = (s: string) => (s ? s.replace(/-/g, ".") : "—")
export const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

const WD = ["일", "월", "화", "수", "목", "금", "토"]
export function todayLabel(today: string) {
  const d = parseDate(today)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`
}

export const ddayText = (n: number) => (n < 0 ? `만료 ${-n}일 지남` : `D-${n}`)

/** 서울 기준 오늘 / 현재 시각 */
export function seoulNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    time: `${g("hour")}:${g("minute")}`,
    stamp: `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`,
  }
}
