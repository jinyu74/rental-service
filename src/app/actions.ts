"use server"

import { refresh } from "next/cache"
import * as db from "@/lib/data"
import { requireSession } from "@/lib/session"
import type { ActionResult, BuildingInput, ContractInput, DepositInput, ExpenseInput, FixedCostInput, FixedRunInput, PaymentInput, QuickRunInput, RoomInput } from "@/lib/types"

async function run<T>(fn: () => Promise<T>, message: string | ((r: T) => string), id?: (r: T) => string): Promise<ActionResult> {
  try {
    await requireSession()
    const r = await fn()
    refresh()
    return { ok: true, message: typeof message === "string" ? message : message(r), ...(id && { id: id(r) }) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function recordPaymentAction(p: PaymentInput) {
  return run(() => db.recordPayment(p), "수납을 시트에 기록했습니다.")
}

export async function deletePaymentAction(id: string) {
  return run(() => db.deletePayment(id), "수납 기록을 삭제했습니다.")
}

export async function saveContractAction(c: ContractInput) {
  return run(() => db.saveContract(c), c.id ? "계약을 수정했습니다." : "새 계약을 등록했습니다.")
}

export async function endContractAction(id: string, end: string) {
  return run(() => db.endContract(id, end), "계약을 종료 처리했습니다.")
}

export async function saveBuildingAction(b: BuildingInput) {
  return run(() => db.saveBuilding(b), b.id ? "건물 정보를 수정했습니다." : "건물을 추가했습니다.")
}

export async function deleteBuildingAction(id: string) {
  return run(() => db.deleteBuilding(id), "건물을 삭제했습니다.")
}

export async function saveRoomAction(r: RoomInput) {
  return run(() => db.saveRoom(r), r.id ? "호실 정보를 수정했습니다." : "호실을 추가했습니다.")
}

export async function deleteRoomAction(id: string) {
  return run(() => db.deleteRoom(id), "호실을 삭제했습니다.")
}

export async function recordDepositAction(d: DepositInput) {
  return run(() => db.recordDeposit(d), d.kind === "반환" ? "보증금 반환을 기록했습니다." : `보증금 ${d.kind} 입금을 기록했습니다.`)
}

export async function deleteDepositAction(id: string) {
  return run(() => db.deleteDeposit(id), "보증금 기록을 삭제했습니다.")
}

export async function saveExpenseAction(e: ExpenseInput) {
  return run(() => db.saveExpense(e), e.id ? "지출을 수정했습니다." : "지출을 기록했습니다.")
}

export async function deleteExpenseAction(id: string) {
  return run(() => db.deleteExpense(id), "지출 기록을 삭제했습니다.")
}

export async function saveFixedCostAction(f: FixedCostInput) {
  return run(() => db.saveFixedCost(f), f.id ? "정기 항목을 수정했습니다." : "정기 항목을 추가했습니다.")
}

export async function deleteFixedCostAction(id: string) {
  return run(() => db.deleteFixedCost(id), "정기 항목을 삭제했습니다.")
}

export async function recordFixedRunAction(r: FixedRunInput) {
  return run(() => db.recordFixedRun(r), (n) => `정기 지출 ${n}건을 기록했습니다.`)
}

export async function saveQuickCostAction(f: FixedCostInput) {
  return run(() => db.saveQuickCost(f), f.id ? "자주 쓰는 항목을 수정했습니다." : "자주 쓰는 항목을 추가했습니다.")
}

export async function deleteQuickCostAction(id: string) {
  return run(() => db.deleteQuickCost(id), "자주 쓰는 항목을 삭제했습니다.")
}

export async function recordQuickAction(q: QuickRunInput) {
  return run(() => db.recordQuick(q), "지출을 기록했습니다.", (id) => id)
}

export async function reloadAction() {
  return run(async () => {}, "시트에서 다시 불러왔습니다.")
}
