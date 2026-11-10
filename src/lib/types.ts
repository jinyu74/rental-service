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
  /** 「중개소」 탭의 ID (직거래면 빈칸) */
  brokerId: string
  /** 저장할 때의 중개소 이름 (시트에서 읽기 쉽게 같이 적어 둠). 화면은 brokerId 로 찾은 현재 이름을 우선 쓴다 */
  brokerName: string
  /** 임대인이 낸 중개수수료 */
  brokerFee: number
  row: number
}

export interface Broker {
  id: string
  name: string
  phone: string
  address: string
  memo: string
  row: number
}

export interface BrokerInput {
  id?: string
  name: string
  phone: string
  address: string
  memo: string
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

/** 자주 쓰는 비정기 지출. 태그를 누르면 바로 지출로 기록된다 (기본 금액 0 이면 금액을 물어본다) */
export type QuickCost = FixedCost

export interface AppData {
  buildings: Building[]
  rooms: Room[]
  contracts: Contract[]
  payments: Payment[]
  deposits: Deposit[]
  expenses: Expense[]
  fixedCosts: FixedCost[]
  quickCosts: QuickCost[]
  brokers: Broker[]
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
  /** 목록에서 고른 중개소. 비우고 newBroker 를 주면 계약 저장 때 중개소도 새로 등록한다 */
  brokerId: string
  newBroker?: { name: string; phone: string }
  brokerFee: number
}

export type ActionResult = { ok: true; message: string; id?: string } | { ok: false; error: string }

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

/** 빠른 지출: 등록한 항목 하나를 그 달 지출로 바로 기록 */
export interface QuickRunInput {
  quickId: string
  month: string
  date: string
}

/** 이번 달 정기 지출을 한 번에 기록 */
export interface FixedRunInput {
  buildingId: string
  month: string
  date: string
  items: { fixedId: string; amount: number }[]
}
