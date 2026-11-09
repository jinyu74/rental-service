"use server"

import { refresh } from "next/cache"
import * as db from "@/lib/data"
import { requireSession } from "@/lib/session"
import type { ActionResult, BuildingInput, ContractInput, PaymentInput, RoomInput } from "@/lib/types"

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

export async function reloadAction() {
  return run(async () => {}, "시트에서 다시 불러왔습니다.")
}
