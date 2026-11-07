"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { roomName } from "@/lib/billing"
import { dotDate, monthNum, won } from "@/lib/format"
import { Empty, Kpi, MonthSwitcher, PageHeader } from "./bits"
import { useRent } from "./rent-app"

export function PaymentsView() {
  const { data, M, month, setMonth, openRoom, openDialog } = useRent()
  const mm = monthNum(month)
  const roomOf = new Map(M.rooms.map((r) => [r.id, r]))
  const cOf = new Map(data.contracts.map((c) => [c.id, c]))
  const list = data.payments
    .filter((p) => p.month === month)
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
  const total = list.reduce((a, p) => a + p.amount, 0)

  return (
    <>
      <PageHeader eyebrow="청구월 기준" title={`${mm}월 수납 내역`}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button size="lg" onClick={() => openDialog({ kind: "pay" })}>
          <Plus /> 수납 기록
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="입금 합계" value={won(total)} sub={`${list.length}건`} />
        <Kpi label="청구액" value={won(M.k.billed)} sub={`수납률 ${M.k.rate}%`} progress={M.k.rate} tone="primary" />
        <div className="col-span-2 md:col-span-1">
          <Kpi label="미수금" value={won(M.k.unpaid)} sub={`${M.k.unpaidN}실`} tone="bad" />
        </div>
      </div>

      <Card className="mt-5 py-1">
        <CardContent className="divide-y">
          {list.length ? (
            list.map((p) => {
              const r = roomOf.get(p.roomId)
              const c = cOf.get(p.contractId)
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <button type="button" onClick={() => openRoom(p.roomId)} className="min-w-0 flex-1 text-left focus-visible:outline-none">
                    <div className="truncate text-sm font-semibold">
                      {r ? roomName(r) : p.roomId} · {c?.tenant ?? ""}
                    </div>
                    <div className="num truncate text-xs text-muted-foreground">
                      {dotDate(p.date)} 입금 · {p.method}
                      {p.memo ? ` · ${p.memo}` : ""}
                    </div>
                  </button>
                  <span className="num text-sm font-semibold whitespace-nowrap">{won(p.amount)}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => openDialog({ kind: "delete", id: p.id })}
                    aria-label={`${dotDate(p.date)} ${won(p.amount)} 기록 삭제`}>
                    <Trash2 />
                  </Button>
                </div>
              )
            })
          ) : (
            <Empty>{mm}월분 수납 기록이 없습니다.</Empty>
          )}
        </CardContent>
      </Card>
    </>
  )
}
