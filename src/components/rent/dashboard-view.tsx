"use client"

import { ExternalLink, MessageSquare, Plus } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { roomName, statusLabel, type RoomView } from "@/lib/billing"
import { dotDate, ddayText, man, md, monthNum, todayLabel, won } from "@/lib/format"
import { Empty, Kpi, MonthSwitcher, PageHeader, Pill, TONE, type Tone } from "./bits"
import { useRent } from "./rent-app"

const toneOf = (r: RoomView): Tone => (r.bill ? r.bill.st : "vacant")

export function DashboardView() {
  const { data, M, month, setMonth, openRoom, openDialog } = useRent()
  const { k } = M
  const mm = monthNum(month)

  return (
    <>
      <PageHeader eyebrow={`${todayLabel(data.today)} 기준`} title={`${mm}월 임대 현황`}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button size="lg" onClick={() => openDialog({ kind: "pay" })}>
          <Plus /> 수납 기록
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={`${mm}월 청구액`} value={won(k.billed)} sub={`월세 ${k.monthlyN}실 · 전세(관리비) ${k.jeonseN}실`} />
        <Kpi label="수납 완료" value={won(k.paid)} sub={`수납률 ${k.rate}% · ${k.paidN}실`} tone="primary" progress={k.rate} />
        <Kpi label="미수금" value={won(k.unpaid)} sub={`${k.unpaidN}실 납부일 경과`} tone="bad" />
        <Kpi label="납부 예정" value={won(k.due)} sub={`${k.dueN}실 · 납부일 전`} />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="입주율" value={`${k.occ}%`} sub={`공실 ${k.total - k.occN}실 / 전체 ${k.total}실`} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4" aria-labelledby="board">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="board" className="text-lg font-semibold">
              호실 현황판
            </h2>
            <Legend />
          </div>
          {M.buildings.map((B) => (
            <Card key={B.building.id}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{B.building.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {B.rooms.length}실 · 월세 {B.monthlyN} · 전세 {B.jeonseN} · 공실 {B.vacantN}
                  <span className="hidden sm:inline"> · 보증금 합계 {man(B.deposit)}</span>
                </p>
                <CardAction className="text-right">
                  <div className="text-xs text-muted-foreground">{mm}월 수납률</div>
                  <div className="num text-xl font-bold text-primary">{B.rate}%</div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Progress value={B.rate} aria-label={`${B.building.name} 수납률`} />
                  <p className="num mt-1.5 text-xs text-muted-foreground">
                    수납 {won(B.paid)} / 청구 {won(B.billed)}
                  </p>
                </div>
                {B.floors.map((F) => (
                  <div key={F.floor} className="flex gap-2 md:gap-3">
                    <div className="w-7 shrink-0 pt-3 text-xs font-semibold text-muted-foreground">{F.floor}F</div>
                    <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
                      {F.rooms.map((r) => {
                        const c = r.billing ?? r.current
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => openRoom(r.id)}
                            aria-label={`${roomName(r)} ${statusLabel(r)}`}
                            className={cn(
                              "flex min-h-[74px] flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                              TONE[toneOf(r)].tile,
                            )}
                          >
                            <span className="flex w-full items-center justify-between text-sm font-bold">
                              {r.no}
                              {c?.type === "전세" && (
                                <span className="rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">전세</span>
                              )}
                            </span>
                            <span className="w-full truncate text-xs text-foreground/80">{c ? c.tenant : "입주자 모집"}</span>
                            <span className="w-full truncate text-[11px] font-medium text-muted-foreground">{statusLabel(r)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>

        <aside className="space-y-4">
          <SideList title="미납" tone="unpaid" count={M.unpaid.length} empty="미납 호실이 없습니다.">
            {M.unpaid.map((r) => (
              <Row key={r.id} onClick={() => openRoom(r.id)} title={`${roomName(r)} · ${r.billing!.tenant}`}
                sub={<span className="text-bad">{won(r.bill!.outstanding)} · 납부일 {r.billing!.payDay}일 · {r.bill!.overdue}일 경과</span>}
                right={
                  r.billing!.phone ? (
                    <a href={`sms:${r.billing!.phone}`} aria-label={`${r.billing!.tenant}님에게 문자`}
                      className={cn(buttonVariants({ variant: "destructive", size: "icon" }))}>
                      <MessageSquare />
                    </a>
                  ) : null
                }
              />
            ))}
          </SideList>
          <SideList title={`${mm}월 납부 예정`} tone="due" count={M.due.length} empty="남은 납부 예정이 없습니다.">
            {M.due.map((r) => (
              <Row key={r.id} onClick={() => openRoom(r.id)} title={`${roomName(r)} · ${r.billing!.tenant}`}
                sub={`${md(r.bill!.dueDate)} · ${r.billing!.type === "전세" ? "관리비" : "임대료+관리비"}`}
                right={<span className="num text-sm font-semibold whitespace-nowrap">{won(r.bill!.outstanding)}</span>}
              />
            ))}
          </SideList>
          <SideList title="계약 만료·갱신" hint="90일 이내·만료" tone="late" count={M.expiring.length} empty="90일 안에 끝나는 계약이 없습니다.">
            {M.expiring.map(({ room: r, dday }) => (
              <Row key={r.id} onClick={() => openRoom(r.id)} title={`${roomName(r)} · ${r.current!.tenant}`}
                sub={`${r.current!.type} · ${dotDate(r.current!.end)} 만료`}
                right={<Pill tone="late">{dday < 0 ? "만료 · 갱신 필요" : ddayText(dday)}</Pill>}
              />
            ))}
          </SideList>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Google Sheets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {data.source === "sheets" ? (
                <p>모든 데이터는 연결된 스프레드시트의 「건물·호실·계약·수납내역」 탭에 저장됩니다. 시트에서 직접 고친 내용은 새로고침하면 반영됩니다.</p>
              ) : (
                <p>지금은 미리보기용 가짜 데이터입니다. 환경변수로 구글 시트를 연결하면 실제 데이터로 바뀝니다(README 참고).</p>
              )}
              {data.sheetUrl && (
                <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <ExternalLink /> 시트 열기
                </a>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  )
}

function Legend() {
  const items: [Tone, string][] = [["paid", "수납완료"], ["due", "납부예정"], ["unpaid", "미납"], ["partial", "일부 미납"], ["vacant", "공실"]]
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map(([t, l]) => (
        <span key={t} className="flex items-center gap-1.5">
          <i className={cn("size-2.5 rounded-sm", TONE[t].dot)} />
          {l}
        </span>
      ))}
    </div>
  )
}

function SideList({ title, hint, tone, count, empty, children }: {
  title: string; hint?: string; tone: Tone; count: number; empty: string; children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-semibold">
          {title} {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>}
        </CardTitle>
        <CardAction>
          <Pill tone={tone}>{count}건</Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="divide-y">{count ? children : <Empty>{empty}</Empty>}</CardContent>
    </Card>
  )
}

function Row({ title, sub, right, onClick }: { title: string; sub: React.ReactNode; right?: React.ReactNode; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={onClick} className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="num truncate text-xs text-muted-foreground">{sub}</div>
      </button>
      {right}
    </div>
  )
}
