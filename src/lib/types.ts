export type ContractType = "월세" | "전세"
export type ContractStatus = "진행" | "종료"

export interface Building {
  id: string
  name: string
  address: string
  memo: string
}

export interface Room {
  id: string
  buildingId: string
  no: string
  floor: number
  area: number | null
  memo: string
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

export interface AppData {
  buildings: Building[]
  rooms: Room[]
  contracts: Contract[]
  payments: Payment[]
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
