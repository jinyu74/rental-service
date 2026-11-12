import type { AppData, Contract, Deposit, Expense, Payment, Room } from "@/lib/types"

/** 테스트용 가상 계약 (실제 임차인 정보 아님) */
export const contract = (o: Partial<Contract> = {}): Contract => ({
  id: "C1",
  roomId: "A-101",
  tenant: "테스트",
  phone: "010-0000-0000",
  type: "월세",
  deposit: 10_000_000,
  rent: 500_000,
  fee: 50_000,
  payDay: 15,
  payMode: "선불",
  start: "2026-03-15",
  end: "2027-03-14",
  status: "진행",
  memo: "",
  brokerId: "",
  brokerName: "",
  brokerFee: 0,
  row: 2,
  ...o,
})

export const room = (o: Partial<Room> = {}): Room => ({ id: "A-101", buildingId: "A", no: "101", floor: 1, area: null, memo: "", row: 2, ...o })

export const payment = (o: Partial<Payment> & Pick<Payment, "contractId" | "month" | "amount">): Payment => ({
  id: "P-" + o.contractId + "-" + o.month,
  roomId: "A-101",
  date: o.month + "-01",
  method: "계좌이체",
  memo: "",
  createdAt: "",
  row: 2,
  ...o,
})

export const deposit = (o: Partial<Deposit> & Pick<Deposit, "kind" | "amount">): Deposit => ({
  id: "D-" + o.kind + o.amount,
  contractId: "C1",
  roomId: "A-101",
  date: "2026-03-01",
  method: "계좌이체",
  memo: "",
  createdAt: "",
  row: 2,
  ...o,
})

export const expense = (o: Partial<Expense> & Pick<Expense, "month" | "amount">): Expense => ({
  id: "E-" + o.month + o.amount,
  buildingId: "A",
  item: "청소",
  date: o.month + "-10",
  memo: "",
  fixedId: "",
  createdAt: "",
  row: 2,
  ...o,
})

export const appData = (o: Partial<AppData> = {}): AppData => ({
  buildings: [
    { id: "A", name: "Building A", address: "", memo: "", row: 2 },
    { id: "B", name: "Building B", address: "", memo: "", row: 3 },
  ],
  rooms: [room()],
  contracts: [],
  payments: [],
  deposits: [],
  expenses: [],
  fixedCosts: [],
  quickCosts: [],
  brokers: [],
  today: "2026-03-20",
  sheetUrl: null,
  syncedAt: "",
  source: "mock",
  ...o,
})
