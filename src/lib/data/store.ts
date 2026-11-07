import type { Building, Contract, Payment, Room } from "../types"
import type { SheetKey } from "./schema"

export interface Tables {
  buildings: Building[]
  rooms: Room[]
  contracts: Contract[]
  payments: Payment[]
}

/** 시트 한 장처럼 동작하는 저장소. 구글 시트와 메모리(미리보기) 두 가지 구현이 있습니다. */
export interface Store {
  readAll(): Promise<Tables>
  append(key: SheetKey, row: (string | number)[]): Promise<void>
  updateCells(key: SheetKey, row: number, fromHeader: string, values: (string | number)[]): Promise<void>
  deleteRow(key: SheetKey, row: number): Promise<void>
}
