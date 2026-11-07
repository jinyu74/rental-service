import "server-only"
import { SHEETS, type SheetKey } from "./schema"
import { range, sheetsFetch } from "./google"
import { mapBuilding, mapContract, mapPayment, mapRoom, toObjects } from "./normalize"
import type { Store, Tables } from "./store"

type BatchGet = { valueRanges: { values?: unknown[][] }[] }

const KEYS: SheetKey[] = ["buildings", "rooms", "contracts", "payments"]

async function readAll(): Promise<Tables> {
  const qs = KEYS.map((k) => "ranges=" + range(SHEETS[k].name)).join("&")
  const res = await sheetsFetch<BatchGet>(
    `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  ).catch((e: Error) => {
    if (/Unable to parse range/.test(e.message)) throw new Error("시트에 「건물·호실·계약·수납내역」 탭이 없습니다. pnpm setup-sheet 를 먼저 실행하세요.")
    throw e
  })
  const [b, r, c, p] = res.valueRanges.map((v) => toObjects(v.values))
  return {
    buildings: b.map(mapBuilding),
    rooms: r.map(mapRoom),
    contracts: c.map(mapContract),
    payments: p.map(mapPayment),
  }
}

async function append(key: SheetKey, row: (string | number)[]) {
  await sheetsFetch(`/values/${range(SHEETS[key].name, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  })
}

const col = (i: number) => String.fromCharCode(65 + i)

async function updateCells(key: SheetKey, row: number, fromHeader: string, values: (string | number)[]) {
  const start = SHEETS[key].headers.indexOf(fromHeader as never)
  const a1 = `${col(start)}${row}:${col(start + values.length - 1)}${row}`
  await sheetsFetch(`/values/${range(SHEETS[key].name, a1)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [values] }),
  })
}

async function deleteRow(key: SheetKey, row: number) {
  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)",
  )
  const sh = meta.sheets.find((s) => s.properties.title === SHEETS[key].name)
  if (!sh) throw new Error(`「${SHEETS[key].name}」 탭이 없습니다.`)
  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: sh.properties.sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
    }),
  })
}

export const sheetsStore: Store = { readAll, append, updateCells, deleteRow }
