export type ContractType = "월세" | "전세"
export type ContractStatus = "진행" | "종료"

export interface Building {
  id: string
  name: string
  address: string
  memo: string
  row: number
}

export interface Room {
  id: string
  buildingId: string
  no: string
  floor: number
  area: number | null
  memo: string
  row: number
}

export interface Contract {
  id: string
  roomId: string
  tenant: string
  phone: string
  type: ContractType
  deposit: number
  rent: number
  fee: number
  payDay: number
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  status: ContractStatus
  memo: string
  row: number
}

export interface Payment {
  id: string
  contractId: string
  roomId: string
  month: string // YYYY-MM
  amount: number
  date: string // YYYY-MM-DD
  method: string
  memo: string
  createdAt: string
  row: number
}

export type DepositKind = "계약금" | "잔금" | "반환"

/** 보증금 입금(계약금·잔금)과 반환 기록. 금액은 항상 양수, 구분으로 방향을 나눈다 */
export interface Deposit {
  id: string
  contractId: string
  roomId: string
  kind: DepositKind
  amount: number
  date: string // YYYY-MM-DD
  method: string
  memo: string
  createdAt: string
  row: number
}

/** 건물 지출. 정기 항목에서 만든 지출은 fixedId 가 있다 */
export interface Expense {
  id: string
  buildingId: string
  month: string // 귀속월 YYYY-MM
  item: string
  amount: number
  date: string // 지출일 YYYY-MM-DD
  memo: string
  fixedId: string
  createdAt: string
  row: number
}

/** 건물마다 매달 나가는 정기 지출 항목(공용전기·청소·인터넷+TV·수도 등) */
export interface FixedCost {
  id: string
  buildingId: string
  item: string
  amount: number // 기본 금액
  memo: string
  row: number
}

export interface AppData {
  buildings: Building[]
  rooms: Room[]
  contracts: Contract[]
  payments: Payment[]
  deposits: Deposit[]
  expenses: Expense[]
  fixedCosts: FixedCost[]
  today: string
  sheetUrl: string | null
  syncedAt: string
  source: "sheets" | "mock"
}

export interface PaymentInput {
  contractId: string
  month: string
  amount: number
  date: string
  method: string
  memo: string
}

export interface ContractInput {
  id?: string
  roomId: string
  tenant: string
  phone: string
  type: ContractType
  deposit: number
  rent: number
  fee: number
  payDay: number
  start: string
  end: string
  memo: string
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

export interface BuildingInput {
  id?: string // 수정할 때만. 새 건물은 code 로 ID 를 만든다
  code: string
  name: string
  address: string
  memo: string
}

export interface RoomInput {
  id?: string // 수정할 때만
  buildingId: string
  no: string
  floor: number
  area: number | null
  memo: string
}

export interface DepositInput {
  contractId: string
  kind: DepositKind
  amount: number
  date: string
  method: string
  memo: string
}

export interface ExpenseInput {
  id?: string // 수정할 때만
  buildingId: string
  month: string
  item: string
  amount: number
  date: string
  memo: string
}

export interface FixedCostInput {
  id?: string
  buildingId: string
  item: string
  amount: number
  memo: string
}

/** 이번 달 정기 지출을 한 번에 기록 */
export interface FixedRunInput {
  buildingId: string
  month: string
  date: string
  items: { fixedId: string; amount: number }[]
}
