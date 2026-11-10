"use client"

import { useRef, useTransition } from "react"
import { CalendarCheck, ListChecks, Pencil, Plus, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"
import { deleteExpenseAction, recordQuickAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fixedStatus, monthFinance } from "@/lib/finance"
import { dotDate, monthNum, won } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { QuickCost } from "@/lib/types"
import { Empty, Kpi, MonthSwitcher, PageHeader, Pill } from "./bits"
import { defaultDate } from "./finance-dialogs"
import { useRent } from "./rent-app"

/** 자주 쓰는 지출 태그. 누르면 보고 있는 달 지출로 바로 기록하고 「되돌리기」를 띄운다 */
function QuickBar({ buildingId }: { buildingId: string }) {
  const { data, month, openDialog } = useRent()
  const [pending, start] = useTransition()
  const lock = useRef(false) // 다시 그려지기 전 연속 클릭도 막는다
  const list = data.quickCosts.filter((q) => q.buildingId === buildingId)

  const tap = (q: QuickCost) => {
    if (!(q.amount > 0)) return openDialog({ kind: "expense", quickId: q.id })
    if (lock.current) return
    lock.current = true
    start(async () => {
      try {
        const r = await recordQuickAction({ quickId: q.id, month, date: defaultDate(data.today, month) })
        if (!r.ok) return void toast.error(r.error)
        const id = r.id
        toast.success(`${monthNum(month)}월 지출 기록: ${q.item} ${won(q.amount)}`, {
          duration: 8000,
          action: id
            ? {
                label: "되돌리기",
                onClick: async () => {
                  const d = await deleteExpenseAction(id)
                  if (d.ok) toast.success("방금 기록을 되돌렸습니다.")
                  else toast.error(d.error)
                },
              }
            : undefined,
        })
      } finally {
        lock.current = false
      }
    })
  }

  return (
    <section className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-sm font-semibold">
          <Zap className="size-3.5 text-muted-foreground" /> 빠른 지출
        </h3>
        <Button variant="ghost" size="sm" aria-label="빠른 지출 항목 관리" onClick={() => openDialog({ kind: "fixedList", buildingId, quick: true })}>
          <ListChecks /> 항목 관리
        </Button>
      </div>
      {list.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.map((q) => (
            <Button key={q.id} variant="outline" size="sm" disabled={pending} onClick={() => tap(q)}
              aria-label={q.amount > 0 ? `${q.item} ${won(q.amount)} 바로 기록` : `${q.item} 금액 입력해 기록`}>
              {q.item}
              <span className="num text-muted-foreground">{q.amount > 0 ? won(q.amount) : "금액 입력"}</span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">소모품·점검·수리처럼 가끔 나가는 지출을 등록하면 눌러서 바로 기록할 수 있습니다.</p>
      )}
    </section>
  )
}

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
                      <Button variant="ghost" size="sm" aria-label="정기 지출 항목 관리" onClick={() => openDialog({ kind: "fixedList", buildingId: b.id })}>
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

                <QuickBar buildingId={b.id} />

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
