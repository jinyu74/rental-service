import "server-only"
import { pad, ymd } from "../format"
import { SHEETS, type SheetKey, DEFAULT_BUILDINGS, defaultRooms } from "./schema"
import { mapBuilding, mapContract, mapPayment, mapRoom, toObjects } from "./normalize"
import type { Store, Tables } from "./store"

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
      for (let back = 3; back >= 0; back--) {
        const m = new Date(today.getFullYear(), today.getMonth() - back, 1)
        if (back === 0 && i % 4 === 3) continue
        const late = back === 2 && i % 7 === 0
        g.payments.push([`P-${i}-${back}`, c.id, r.id, ymd(m).slice(0, 7), c.rent + c.fee,
          ymd(new Date(m.getFullYear(), m.getMonth(), Math.min(c.payDay + (late ? 9 : 0), 28))), "계좌이체", "", ymd(m)])
      }
    })
  return g
}

const g = globalThis as unknown as { __rentMock?: Grid }
const grid = () => (g.__rentMock ??= seed())

export const mockStore: Store = {
  async readAll(): Promise<Tables> {
    const d = grid()
    return {
      buildings: toObjects(d.buildings).map(mapBuilding),
      rooms: toObjects(d.rooms).map(mapRoom),
      contracts: toObjects(d.contracts).map(mapContract),
      payments: toObjects(d.payments).map(mapPayment),
    }
  },
  async append(key, row) {
    grid()[key].push(row)
  },
  async updateCells(key, row, fromHeader, values) {
    const start = SHEETS[key].headers.indexOf(fromHeader as never)
    const target = grid()[key][row - 1]
    values.forEach((v, i) => (target[start + i] = v))
  },
  async deleteRow(key, row) {
    grid()[key].splice(row - 1, 1)
  },
}
