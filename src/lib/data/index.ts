import "server-only"
import { seoulNow } from "../format"
import type { AppData, ContractInput, PaymentInput } from "../types"
import { sheetUrl, sheetsConfig } from "./google"
import { mockStore } from "./mock-store"
import { sheetsStore } from "./sheets-store"

const isSheetsMode = () => !!sheetsConfig()
const store = () => (isSheetsMode() ? sheetsStore : mockStore)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

function newId(prefix: string) {
  const s = seoulNow().stamp.replace(/\D/g, "").slice(2)
  return `${prefix}-${s}-${Math.floor(Math.random() * 900 + 100)}`
}

export async function getData(): Promise<AppData> {
  const t = await store().readAll()
  const now = seoulNow()
  return {
    ...t,
    today: now.date,
    syncedAt: now.time,
    sheetUrl: sheetUrl(),
    source: isSheetsMode() ? "sheets" : "mock",
  }
}

export async function recordPayment(p: PaymentInput) {
  if (!p.contractId || !p.month) throw new Error("계약과 청구월이 필요합니다.")
  if (!(p.amount > 0)) throw new Error("입금액을 확인하세요.")
  if (!MONTH.test(p.month)) throw new Error("청구월 형식은 YYYY-MM 입니다.")
  if (!DATE.test(p.date)) throw new Error("입금일을 확인하세요.")
  const { contracts } = await store().readAll()
  const c = contracts.find((x) => x.id === p.contractId)
  if (!c) throw new Error("계약을 찾을 수 없습니다.")
  await store().append("payments", [newId("P"), c.id, c.roomId, p.month, p.amount, p.date, p.method || "계좌이체", p.memo || "", seoulNow().stamp])
}

export async function deletePayment(id: string) {
  const { payments } = await store().readAll()
  const hit = payments.find((p) => p.id === id)
  if (!hit) throw new Error("수납 기록을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.")
  await store().deleteRow("payments", hit.row)
}

export async function saveContract(c: ContractInput) {
  if (!c.roomId) throw new Error("호실을 선택하세요.")
  if (!c.tenant.trim()) throw new Error("임차인 이름을 입력하세요.")
  if (c.type !== "월세" && c.type !== "전세") throw new Error("유형은 월세 또는 전세입니다.")
  if (!DATE.test(c.start) || !DATE.test(c.end)) throw new Error("계약 기간을 확인하세요.")
  if (c.end < c.start) throw new Error("종료일이 시작일보다 빠릅니다.")
  const payDay = Math.min(31, Math.max(1, Math.round(c.payDay) || 1))
  const rent = c.type === "전세" ? 0 : c.rent

  const { contracts, rooms } = await store().readAll()
  if (!rooms.some((r) => r.id === c.roomId)) throw new Error("호실을 찾을 수 없습니다.")
  const overlap = contracts.find(
    (x) => x.roomId === c.roomId && x.status === "진행" && x.id !== (c.id ?? "") && x.start <= c.end && x.end >= c.start,
  )
  if (overlap) throw new Error(`같은 기간에 진행 중인 계약(${overlap.tenant})이 있습니다. 기존 계약을 먼저 종료하세요.`)

  const values = [c.roomId, c.tenant.trim(), c.phone.trim(), c.type, c.deposit, rent, c.fee, payDay, c.start, c.end]
  if (c.id) {
    const hit = contracts.find((x) => x.id === c.id)
    if (!hit) throw new Error("계약을 찾을 수 없습니다.")
    await store().updateCells("contracts", hit.row, "호실ID", [...values, hit.status, c.memo])
    return
  }
  await store().append("contracts", [newId("C"), ...values, "진행", c.memo, seoulNow().stamp])
}

export async function endContract(id: string, end: string) {
  if (!DATE.test(end)) throw new Error("퇴실일을 확인하세요.")
  const { contracts } = await store().readAll()
  const hit = contracts.find((x) => x.id === id)
  if (!hit) throw new Error("계약을 찾을 수 없습니다.")
  if (end < hit.start) throw new Error("퇴실일이 계약 시작일보다 빠릅니다.")
  await store().updateCells("contracts", hit.row, "종료일", [end, "종료"])
}
