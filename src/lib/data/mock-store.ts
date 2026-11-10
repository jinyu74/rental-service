import "server-only"
import { pad, ymd } from "../format"
import { SHEETS, type SheetKey, DEFAULT_BUILDINGS, defaultRooms } from "./schema"
import { mapBuilding, mapContract, mapDeposit, mapExpense, mapFixedCost, mapPayment, mapRoom, toObjects } from "./normalize"
import { STALE, serialQueue, type Store, type Tables } from "./store"

/**
 * 구글 시트 없이 화면을 확인하기 위한 메모리 저장소.
 * 시트와 같은 2차원 배열로 보관해서 실제 저장소와 똑같은 코드 경로(행 번호 포함)를 탑니다.
 * 서버를 재시작하면 초기화됩니다.
 */
type Grid = Record<SheetKey, unknown[][]>

function seed(): Grid {
  const today = new Date()
  const g: Grid = {
    buildings: [SHEETS.buildings.headers.slice(), ...DEFAULT_BUILDINGS.map((b) => [b.id, b.name, "", ""])],
    rooms: [SHEETS.rooms.headers.slice(), ...defaultRooms().map((r) => [r.id, r.buildingId, r.no, r.floor, "", ""])],
    contracts: [SHEETS.contracts.headers.slice()],
    payments: [SHEETS.payments.headers.slice()],
    deposits: [SHEETS.deposits.headers.slice()],
    expenses: [SHEETS.expenses.headers.slice()],
    fixedCosts: [SHEETS.fixedCosts.headers.slice()],
  }
  const names = ["김민준", "이서연", "박지호", "최유진", "정하늘", "강도윤", "윤서아", "임준서", "한지민", "오세훈", "서지우", "신예린", "조현우", "배수빈", "문태양", "장예준", "홍다은", "유시우", "노하린", "권도현", "송민서", "안지후", "류채원", "전우진", "고은채", "남건우", "황서윤", "차민재", "표하은"]
  const vacant = ["CC-203", "SH-205", "SH-404"]
  const jeonse = ["CC-103", "CC-204", "CC-303", "SH-103", "SH-202", "SH-303", "SH-401"]
  defaultRooms()
    .filter((r) => !vacant.includes(r.id))
    .forEach((r, i) => {
      const cc = r.buildingId === "CC"
      const j = jeonse.includes(r.id)
      const start = new Date(today.getFullYear() - 1, ((i * 5) % 12) - (i % 3 === 0 ? 10 : 0), 1)
      const end = new Date(start.getFullYear() + 2, start.getMonth(), 0)
      const c = {
        id: `C-${pad(i + 1)}`,
        rent: j ? 0 : cc ? 450000 : 550000,
        fee: cc ? 50000 : 70000,
        payDay: [1, 5, 10, 15, 25][i % 5],
      }
      g.contracts.push([c.id, r.id, names[i], `010-0000-${1000 + i * 37}`, j ? "전세" : "월세",
        j ? (cc ? 120000000 : 150000000) : cc ? 5000000 : 10000000, c.rent, c.fee, c.payDay, ymd(start), ymd(end), "진행", "", ""])
      const dep = j ? (cc ? 120000000 : 150000000) : cc ? 5000000 : 10000000
      // 대부분 완납, 몇 곳은 계약금만 들어온 상태
      g.deposits.push([`D-${i}-1`, c.id, r.id, "계약금", dep / 10, ymd(new Date(start.getFullYear(), start.getMonth() - 1, 10)), "계좌이체", "", ""])
      if (i % 9 !== 4) g.deposits.push([`D-${i}-2`, c.id, r.id, "잔금", dep - dep / 10, ymd(start), "계좌이체", "", ""])
      for (let back = 3; back >= 0; back--) {
        const m = new Date(today.getFullYear(), today.getMonth() - back, 1)
        if (back === 0 && i % 4 === 3) continue
        const late = back === 2 && i % 7 === 0
        g.payments.push([`P-${i}-${back}`, c.id, r.id, ymd(m).slice(0, 7), c.rent + c.fee,
          ymd(new Date(m.getFullYear(), m.getMonth(), Math.min(c.payDay + (late ? 9 : 0), 28))), "계좌이체", "", ymd(m)])
      }
    })
  // 다음 달 입주 예정 계약 하나 (계약금만 입금)
  const ns = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  g.contracts.push(["C-NEW", "SH-404", "신입주", "010-0000-9999", "월세", 10000000, 550000, 70000, 1, ymd(ns), ymd(new Date(ns.getFullYear() + 2, ns.getMonth(), 0)), "진행", "", ""])
  g.deposits.push(["D-NEW-1", "C-NEW", "SH-404", "계약금", 1000000, ymd(new Date(today.getFullYear(), today.getMonth(), Math.max(1, today.getDate() - 3))), "계좌이체", "", ""])

  // 정기 지출 항목과 최근 4개월 지출
  const fixed: [string, string, string, number][] = [
    ["FX-CC-1", "CC", "공용전기", 85000], ["FX-CC-2", "CC", "청소", 150000], ["FX-CC-3", "CC", "인터넷+TV", 132000], ["FX-CC-4", "CC", "수도", 210000],
    ["FX-SH-1", "SH", "공용전기", 120000], ["FX-SH-2", "SH", "청소", 200000], ["FX-SH-3", "SH", "인터넷+TV", 187000], ["FX-SH-4", "SH", "수도", 290000],
  ]
  for (const [id, b, item, amount] of fixed) g.fixedCosts.push([id, b, item, amount, ""])
  for (let back = 3; back >= 1; back--) {
    const m = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const mon = ymd(m).slice(0, 7)
    fixed.forEach(([id, b, item, amount], k) => {
      const v = item === "공용전기" || item === "수도" ? Math.round((amount * (0.85 + ((back * 7 + k) % 5) * 0.08)) / 10) * 10 : amount
      g.expenses.push([`E-${back}-${k}`, b, mon, item, v, ymd(new Date(m.getFullYear(), m.getMonth(), 25)), "", id, ""])
    })
  }
  const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  g.expenses.push(["E-R1", "SH", ymd(lm).slice(0, 7), "수선·하자보수", 380000, ymd(new Date(lm.getFullYear(), lm.getMonth(), 14)), "302호 보일러 배관 누수 수리", "", ""])
  g.expenses.push(["E-R2", "CC", ymd(today).slice(0, 7), "수선·하자보수", 95000, ymd(today), "공용 복도 전등 교체", "", ""])
  return g
}

const g = globalThis as unknown as { __rentMock?: Grid }
const grid = () => (g.__rentMock ??= seed())
// 메모리 저장소는 프로세스 하나에만 있으므로 프로세스 안 큐로 충분하다
const mockQueue = serialQueue()

export const mockStore: Store = {
  async readAll(): Promise<Tables> {
    const d = grid()
    return {
      buildings: toObjects(d.buildings).map(mapBuilding),
      rooms: toObjects(d.rooms).map(mapRoom),
      contracts: toObjects(d.contracts).map(mapContract),
      payments: toObjects(d.payments).map(mapPayment),
      deposits: toObjects(d.deposits).map(mapDeposit),
      expenses: toObjects(d.expenses).map(mapExpense),
      fixedCosts: toObjects(d.fixedCosts).map(mapFixedCost),
    }
  },
  async append(key, rows) {
    grid()[key].push(...rows)
  },
  async updateCells(key, row, id, fromHeader, values) {
    if (String(grid()[key][row - 1]?.[0] ?? "") !== id) throw new Error(STALE)
    const start = SHEETS[key].headers.indexOf(fromHeader as never)
    const target = grid()[key][row - 1]
    values.forEach((v, i) => (target[start + i] = v))
  },
  async deleteRow(key, row, id) {
    if (String(grid()[key][row - 1]?.[0] ?? "") !== id) throw new Error(STALE)
    grid()[key].splice(row - 1, 1)
  },
  transaction: (fn) => mockQueue(fn),
}
