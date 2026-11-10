import type { AppData, Contract, Deposit, Expense } from "./types"
import { addMonth, daysBetween } from "./format"
import { compute } from "./billing"

/* ───────── 보증금 ───────── */

export type DepositStatus = "none" | "unpaid" | "partial" | "full" | "returning" | "returned"

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: "보증금 없음",
  unpaid: "미입금",
  partial: "일부 입금",
  full: "완납",
  returning: "일부 반환",
  returned: "반환 완료",
}

export interface DepositView {
  contract: Contract
  records: Deposit[]
  /** 받은 돈(계약금+잔금) */
  received: number
  returned: number
  /** 지금 갖고 있는 보증금 */
  held: number
  /** 약정액까지 더 받을 돈 */
  remaining: number
  st: DepositStatus
}

export function depositOf(c: Contract, all: Deposit[]): DepositView {
  const records = all.filter((d) => d.contractId === c.id).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
  const received = records.filter((d) => d.kind !== "반환").reduce((a, d) => a + d.amount, 0)
  const returned = records.filter((d) => d.kind === "반환").reduce((a, d) => a + d.amount, 0)
  const held = received - returned
  let st: DepositStatus
  if (returned > 0) st = held > 0 ? "returning" : "returned"
  else if (c.deposit <= 0) st = "none"
  else if (received >= c.deposit) st = "full"
  else st = received > 0 ? "partial" : "unpaid"
  return { contract: c, records, received, returned, held, remaining: Math.max(0, c.deposit - received), st }
}

/** 이 기간 안에 입주했거나 입주 예정인 계약만 보증금 미입금 알림 대상 (앱 도입 전 계약은 기록이 없어도 알리지 않음) */
const ALERT_AFTER_MOVE_IN_DAYS = 60

export function depositAlerts(data: AppData) {
  return data.contracts
    .filter((c) => c.status === "진행" && c.deposit > 0 && daysBetween(c.start, data.today) <= ALERT_AFTER_MOVE_IN_DAYS)
    .map((c) => ({ ...depositOf(c, data.deposits), dday: daysBetween(data.today, c.start) }))
    .filter((d) => d.remaining > 0)
    .sort((a, b) => a.dday - b.dday)
}

/** 퇴실(종료)했는데 아직 돌려주지 않은 보증금 */
export function depositReturnsDue(data: AppData) {
  return data.contracts
    .filter((c) => c.status === "종료")
    .map((c) => depositOf(c, data.deposits))
    .filter((d) => d.held > 0)
}

/* ───────── 수입·지출 ───────── */

const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)

export interface MonthFinance {
  month: string
  billed: number
  /** 청구월 기준 실제 입금액 */
  income: number
  expense: number
  fixedExpense: number
  otherExpense: number
  /** 순수익 = 입금 − 지출 */
  net: number
  /** 예상 순수익 = 청구 − 지출 */
  expectedNet: number
}

export function monthFinance(data: AppData, month: string, billed: number, buildingId?: string): MonthFinance {
  const roomB = new Map(data.rooms.map((r) => [r.id, r.buildingId]))
  const pays = data.payments.filter((p) => p.month === month && (!buildingId || roomB.get(p.roomId) === buildingId))
  const exps = data.expenses.filter((e) => e.month === month && (!buildingId || e.buildingId === buildingId))
  const income = sum(pays, (p) => p.amount)
  const expense = sum(exps, (e) => e.amount)
  const fixedExpense = sum(exps.filter((e) => e.fixedId), (e) => e.amount)
  return {
    month,
    billed,
    income,
    expense,
    fixedExpense,
    otherExpense: expense - fixedExpense,
    net: income - expense,
    expectedNet: billed - expense,
  }
}

/** 선택한 달까지 최근 n개월 */
export function monthlyFinance(data: AppData, month: string, n = 6) {
  return Array.from({ length: n }, (_, i) => addMonth(month, i - n + 1)).map((m) =>
    monthFinance(data, m, compute(data, m).k.billed),
  )
}

/** 정기 항목별 이번 달 기록 여부와 추천 금액(가장 최근 기록, 없으면 기본 금액) */
export function fixedStatus(data: AppData, buildingId: string, month: string) {
  return data.fixedCosts
    .filter((f) => f.buildingId === buildingId)
    .map((f) => {
      const recs = data.expenses.filter((e) => e.fixedId === f.id)
      const done: Expense | undefined = recs.find((e) => e.month === month)
      const last = recs.filter((e) => e.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]
      return { fixed: f, done, suggest: last?.amount || f.amount, lastMonth: last?.month ?? null }
    })
}
