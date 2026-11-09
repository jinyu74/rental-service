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
  /** row 행의 첫 열(ID)이 id 와 같을 때만 쓴다. 다르면 STALE 오류 (그사이 행이 밀린 경우) */
  updateCells(key: SheetKey, row: number, id: string, fromHeader: string, values: (string | number)[]): Promise<void>
  deleteRow(key: SheetKey, row: number, id: string): Promise<void>
  /** fn 을 다른 쓰기와 겹치지 않게 실행한다. 「읽기 → 검사 → 쓰기」 전체를 이 안에서 한다 */
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

export const STALE = "시트 내용이 그사이 바뀌었습니다. 새로고침 후 다시 시도하세요."

/** 같은 서버 프로세스 안에서 작업을 하나씩 실행하는 큐 */
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn)
    tail = run.catch(() => {})
    return run
  }
}
