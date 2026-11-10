"use client"

import { CalendarCheck, ListChecks, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fixedStatus, monthFinance } from "@/lib/finance"
import { dotDate, monthNum, won } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Empty, Kpi, MonthSwitcher, PageHeader, Pill } from "./bits"
import { useRent } from "./rent-app"

export function ExpensesView() {
  const { data, M, month, setMonth, openDialog } = useRent()
  const mm = monthNum(month)
  const f = monthFinance(data, month, M.k.billed)

  return (
    <>
      <PageHeader eyebrow="귀속월 기준" title={`${mm}월 지출`}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button size="lg" onClick={() => openDialog({ kind: "expense" })}>
          <Plus /> 지출 기록
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`${mm}월 지출 합계`} value={won(f.expense)} sub={`정기 ${won(f.fixedExpense)} · 기타 ${won(f.otherExpense)}`} tone="bad" />
        <Kpi label="수납 (입금)" value={won(f.income)} sub={`청구 ${won(f.billed)}`} />
        <Kpi label="순수익" value={won(f.net)} sub="수납 − 지출" tone={f.net < 0 ? "bad" : "primary"} />
        <Kpi label="예상 순수익" value={won(f.expectedNet)} sub="청구액이 모두 들어올 때" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.buildings.map((b) => {
          const fixed = fixedStatus(data, b.id, month)
          const missing = fixed.filter((x) => !x.done)
          const list = data.expenses
            .filter((e) => e.buildingId === b.id && e.month === month)
            .sort((a, c) => (c.date + c.createdAt).localeCompare(a.date + a.createdAt))
          const bf = monthFinance(data, month, 0, b.id)
          return (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{b.name}</CardTitle>
                <p className="num text-sm text-muted-foreground">
                  지출 {won(bf.expense)} · 수납 {won(bf.income)} · 순수익{" "}
                  <span className={cn("font-semibold", bf.net < 0 ? "text-bad" : "text-foreground")}>{won(bf.net)}</span>
                </p>
                <CardAction>
                  <Button variant="outline" size="sm" onClick={() => openDialog({ kind: "expense", buildingId: b.id })}>
                    <Plus /> 지출
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <section className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      정기 지출{" "}
                      {fixed.length > 0 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {fixed.length - missing.length}/{fixed.length} 기록
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openDialog({ kind: "fixedList", buildingId: b.id })}>
                        <ListChecks /> 항목 관리
                      </Button>
                      {(missing.length > 0 || !fixed.length) && (
                        <Button size="sm" onClick={() => openDialog({ kind: "fixedRun", buildingId: b.id })}>
                          <CalendarCheck /> {mm}월분 기록
                        </Button>
                      )}
                    </div>
                  </div>
                  {fixed.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {fixed.map(({ fixed: x, done }) => (
                        <li key={x.id}>
                          <Pill tone={done ? "paid" : "vacant"}>
                            {x.item} {done ? won(done.amount) : "미기록"}
                          </Pill>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">공용전기·청소·인터넷+TV·수도처럼 매달 나가는 항목을 등록하세요.</p>
                  )}
                </section>

                <div className="divide-y">
                  {list.length ? (
                    list.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {e.item}
                            {e.fixedId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">정기</span>}
                          </div>
                          <div className="num truncate text-xs text-muted-foreground">
                            {dotDate(e.date)}
                            {e.memo ? ` · ${e.memo}` : ""}
                          </div>
                        </div>
                        <span className="num text-sm font-semibold whitespace-nowrap">{won(e.amount)}</span>
                        <Button variant="ghost" size="icon-sm" aria-label={`${e.item} ${won(e.amount)} 수정`} onClick={() => openDialog({ kind: "expense", id: e.id })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`${e.item} ${won(e.amount)} 삭제`} onClick={() => openDialog({ kind: "deleteExpense", id: e.id })}>
                          <Trash2 />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Empty>{mm}월 지출 기록이 없습니다.</Empty>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
