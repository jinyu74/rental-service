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
  deposits: {
    name: "보증금내역",
    headers: ["보증금ID", "계약ID", "호실ID", "구분", "금액", "일자", "방법", "메모", "기록일시"],
  },
  expenses: {
    name: "지출내역",
    headers: ["지출ID", "건물ID", "귀속월", "항목", "금액", "지출일", "메모", "정기항목ID", "기록일시"],
  },
  fixedCosts: {
    name: "정기지출",
    headers: ["정기항목ID", "건물ID", "항목", "기본금액", "메모"],
  },
} as const

/** 처음부터 있던 탭. 나중에 추가된 탭(보증금·지출·정기지출)은 없으면 빈 목록으로 읽고, 처음 쓸 때 만든다 */
export const CORE_KEYS = ["buildings", "rooms", "contracts", "payments"] as const
export const SHEET_KEYS = [...CORE_KEYS, "deposits", "expenses", "fixedCosts"] as const

/** 지출 항목 추천 목록 (직접 입력도 가능) */
export const EXPENSE_ITEMS = ["공용전기", "수도", "청소", "인터넷+TV", "승강기 유지보수", "소방 점검", "수선·하자보수", "소모품", "세금·보험", "기타"]

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
