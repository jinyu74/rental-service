/** 구글 시트 탭 구성 (Apps Script 버전과 동일) */
export const SHEETS = {
  buildings: { name: "건물", headers: ["건물ID", "건물명", "주소", "메모"] },
  rooms: { name: "호실", headers: ["호실ID", "건물ID", "호수", "층", "면적(㎡)", "메모"] },
  contracts: {
    name: "계약",
    headers: ["계약ID", "호실ID", "임차인", "연락처", "유형", "보증금", "월임대료", "관리비", "납부일", "시작일", "종료일", "상태", "메모", "등록일시"],
  },
  payments: {
    name: "수납내역",
    headers: ["수납ID", "계약ID", "호실ID", "청구월", "입금액", "입금일", "방법", "메모", "기록일시"],
  },
} as const

export type SheetKey = keyof typeof SHEETS

/** 초기 호실 배치 (예시). 실제와 다르면 시트 「호실」 탭에서 수정 */
export const DEFAULT_BUILDINGS = [
  { id: "CC", name: "춘천건물", layout: { 1: 3, 2: 5, 3: 5 } as Record<number, number> },
  { id: "SH", name: "시흥건물", layout: { 1: 4, 2: 5, 3: 5, 4: 5 } as Record<number, number> },
]

export function defaultRooms() {
  const rows: { id: string; buildingId: string; no: string; floor: number }[] = []
  for (const b of DEFAULT_BUILDINGS) {
    for (const [f, n] of Object.entries(b.layout)) {
      for (let i = 1; i <= n; i++) {
        const no = f + String(i).padStart(2, "0")
        rows.push({ id: `${b.id}-${no}`, buildingId: b.id, no, floor: Number(f) })
      }
    }
  }
  return rows
}
