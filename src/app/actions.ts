"use server"

import { refresh } from "next/cache"
import * as db from "@/lib/data"
import { requireSession } from "@/lib/session"
import type { ActionResult, ContractInput, PaymentInput } from "@/lib/types"

async function run(fn: () => Promise<void>, message: string): Promise<ActionResult> {
  try {
    await requireSession()
    await fn()
    refresh()
    return { ok: true, message }
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

export async function reloadAction() {
  return run(async () => {}, "시트에서 다시 불러왔습니다.")
}
