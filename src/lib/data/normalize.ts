import { pad } from "../format"
import type { Building, Contract, Payment, Room } from "../types"

export type Row = Record<string, unknown> & { _row: number }

export const str = (v: unknown) => (v == null ? "" : String(v).trim())

export function num(v: unknown) {
  if (typeof v === "number") return v
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isNaN(n) ? 0 : n
}

/** "2026-11-06", "2026. 11. 6", "2026/11/6", 시트 날짜 일련번호 → YYYY-MM-DD */
export function normDate(v: unknown) {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const m = str(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  return m ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : str(v)
}

export function normMonth(v: unknown) {
  if (typeof v === "number") return normDate(v).slice(0, 7)
  const m = str(v).match(/(\d{4})\D+(\d{1,2})/)
  return m ? `${m[1]}-${pad(+m[2])}` : str(v)
}

export function toObjects(values: unknown[][] | undefined): Row[] {
  if (!values || values.length < 2) return []
  const headers = values[0].map(String)
  return values
    .slice(1)
    .map((row, i) => {
      const o: Row = { _row: i + 2 }
      headers.forEach((h, c) => (o[h] = row[c] ?? ""))
      return o
    })
    .filter((o) => str(o[headers[0]]) !== "")
}

export const mapBuilding = (r: Row): Building => ({
  id: str(r["건물ID"]),
  name: str(r["건물명"]),
  address: str(r["주소"]),
  memo: str(r["메모"]),
  row: r._row,
})

export const mapRoom = (r: Row): Room => ({
  id: str(r["호실ID"]),
  buildingId: str(r["건물ID"]),
  no: str(r["호수"]),
  floor: num(r["층"]),
  area: str(r["면적(㎡)"]) === "" ? null : num(r["면적(㎡)"]),
  memo: str(r["메모"]),
  row: r._row,
})

export const mapContract = (r: Row): Contract => ({
  id: str(r["계약ID"]),
  roomId: str(r["호실ID"]),
  tenant: str(r["임차인"]),
  phone: str(r["연락처"]),
  type: str(r["유형"]) === "전세" ? "전세" : "월세",
  deposit: num(r["보증금"]),
  rent: num(r["월임대료"]),
  fee: num(r["관리비"]),
  payDay: num(r["납부일"]) || 1,
  start: normDate(r["시작일"]),
  end: normDate(r["종료일"]),
  status: str(r["상태"]) === "종료" ? "종료" : "진행",
  memo: str(r["메모"]),
  row: r._row,
})

export const mapPayment = (r: Row): Payment => ({
  id: str(r["수납ID"]),
  contractId: str(r["계약ID"]),
  roomId: str(r["호실ID"]),
  month: normMonth(r["청구월"]),
  amount: num(r["입금액"]),
  date: normDate(r["입금일"]),
  method: str(r["방법"]),
  memo: str(r["메모"]),
  createdAt: str(r["기록일시"]),
  row: r._row,
})
