"use client"

import { FileSpreadsheet, MessageSquare, Pencil, Phone, Plus, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { BILL_LABEL, billOf, statusLabel, type RoomView } from "@/lib/billing"
import { addMonth, daysBetween, dotDate, md, monthEnd, monthNum, won } from "@/lib/format"
import { DEPOSIT_LABEL, depositOf, type DepositStatus } from "@/lib/finance"
import type { Contract } from "@/lib/types"
import { Empty, Pill, TypeBadge, type Tone } from "./bits"
import { useRent } from "./rent-app"

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function KV({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between py-1 text-sm", strong && "mt-1 border-t border-dashed pt-2")}>
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{k}</span>
      <span className={cn("num", strong ? "font-bold" : "font-medium")}>{v}</span>
    </div>
  )
}

export function RoomDetail({ room: r, hideTitle }: { room: RoomView; hideTitle?: boolean }) {
  const { data, M, month, openDialog } = useRent()
  const c = r.current
  const tone: Tone = r.bill ? r.bill.st : "vacant"

  const head = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground">
          {r.building.name} · {r.floor}층{r.area ? ` · ${r.area}㎡` : ""}
        </p>
        {!hideTitle && <h2 className="text-2xl font-bold">{r.no}호</h2>}
      </div>
      <div className="flex items-center gap-1.5">
        {c && <TypeBadge contract={c} />}
        <Pill tone={tone}>{statusLabel(r)}</Pill>
      </div>
    </div>
  )

  if (!c) {
    const last = r.list[0]
    return (
      <div className="space-y-5 py-5">
        {head}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-8 text-center">
          <span className="font-semibold">현재 공실입니다</span>
          {last && (
            <span className="text-xs text-muted-foreground">
              직전 계약: {last.tenant} · {last.type} · {dotDate(last.start)} ~ {dotDate(last.end)}
            </span>
          )}
          <Button onClick={() => openDialog({ kind: "contract", roomId: r.id })}>
            <Plus /> 이 호실에 새 계약 등록
          </Button>
        </div>
        {last && <DepositSection contract={last} onlyIfHeld />}
        <RoomAdmin room={r} />
      </div>
    )
  }

  const dd = daysBetween(data.today, c.end)
  const total = Math.max(1, daysBetween(c.start, c.end))
  const prog = Math.max(0, Math.min(100, Math.round((daysBetween(c.start, data.today) / total) * 100)))
  const bill = r.billing?.id === c.id && r.bill ? r.bill : M.statusFor(c, month)
  const alert = bill.st === "unpaid" || bill.st === "partial"

  const months = Array.from({ length: 6 }, (_, i) => addMonth(month, -i))
  const pays = data.payments
    .filter((p) => p.contractId === c.id)
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))

  return (
    <div className="space-y-5 py-5">
      {head}

      <div className={cn("rounded-xl border p-4", alert && "border-red-300 bg-red-50/40")}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {monthNum(month)}월 청구 · 매월 {c.payDay}일
          </span>
          <Pill tone={bill.st}>{BILL_LABEL[bill.st]}</Pill>
        </div>
        <div className="num mt-1 text-2xl font-bold">{won(bill.billed)}</div>
        <div className="num text-xs text-muted-foreground">
          {c.type === "전세" ? `관리비 ${won(c.fee)} (전세)` : `임대료 ${won(c.rent)} + 관리비 ${won(c.fee)}`}
          {bill.paid ? ` · 입금 ${won(bill.paid)}` : ""}
        </div>
        {bill.outstanding > 0 && (
          <Button className="mt-3 w-full" size="lg" onClick={() => openDialog({ kind: "pay", contractId: c.id })}>
            <Plus /> 수납 기록 ({won(bill.outstanding)})
          </Button>
        )}
      </div>

      <Section title="임차인">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{c.tenant}</div>
            <div className="text-sm text-muted-foreground">{c.phone || "연락처 없음"}</div>
          </div>
          {c.phone && (
            <div className="flex gap-2">
              <a href={`tel:${c.phone}`} aria-label={`${c.tenant}님에게 전화`} className={buttonVariants({ variant: "secondary", size: "icon-lg" })}>
                <Phone />
              </a>
              <a href={`sms:${c.phone}`} aria-label={`${c.tenant}님에게 문자`} className={buttonVariants({ variant: "secondary", size: "icon-lg" })}>
                <MessageSquare />
              </a>
            </div>
          )}
        </div>
      </Section>
      <Separator />

      <Section title="계약 조건">
        <div>
          <KV k="유형" v={c.type === "전세" ? "전세 (관리비만 청구)" : "월세"} />
          <KV k="보증금" v={won(c.deposit)} />
          {c.type !== "전세" && <KV k="월 임대료" v={won(c.rent)} />}
          <KV k="월 관리비" v={won(c.fee)} />
          <KV k="매월 청구액" v={won(billOf(c))} strong />
        </div>
        {c.memo && <p className="text-xs text-muted-foreground">메모: {c.memo}</p>}
      </Section>
      <Separator />

      <DepositSection contract={c} />
      <Separator />

      <Section
        title="계약 기간"
        aside={
          <span className={cn("text-xs font-semibold", dd <= 90 ? "text-warn" : "text-muted-foreground")}>
            {dd < 0 ? `만료 ${-dd}일 지남 · 묵시적 갱신 중` : `만료까지 D-${dd}`}
          </span>
        }
      >
        <Progress value={prog} aria-label="계약 경과" />
        <div className="num flex justify-between text-xs text-muted-foreground">
          <span>{dotDate(c.start)}</span>
          <span>{dotDate(c.end)}</span>
        </div>
      </Section>
      <Separator />

      <Section title="최근 6개월 수납">
        <div className="divide-y">
          {months.map((m) => {
            if (c.start > monthEnd(m) || (c.status === "종료" && c.end < m + "-01"))
              return (
                <div key={m} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-8 font-semibold">{monthNum(m)}월</span>
                  <span className="text-muted-foreground">계약 기간 아님</span>
                </div>
              )
            const s = M.statusFor(c, m)
            const mp = data.payments.filter((p) => p.contractId === c.id && p.month === m)
            const late = s.st === "paid" && mp.length > 0 && mp[mp.length - 1].date > s.dueDate
            const dateTxt = mp.length
              ? mp.map((p) => md(p.date)).join(", ") + " 입금"
              : s.st === "due"
                ? `${md(s.dueDate)} 납부일`
                : "미입금"
            return (
              <div key={m} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-8 font-semibold">{monthNum(m)}월</span>
                <span className="num flex-1 truncate text-muted-foreground">
                  {won(s.billed)} · {dateTxt}
                </span>
                <Pill tone={late ? "late" : s.st}>{late ? "지연납부" : BILL_LABEL[s.st]}</Pill>
              </div>
            )
          })}
        </div>
      </Section>
      <Separator />

      <Section title="수납 기록">
        {pays.length ? (
          <div className="divide-y">
            {pays.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-2">
                <div className="flex-1">
                  <div className="num text-sm font-semibold">
                    {won(p.amount)} <span className="text-xs font-normal text-muted-foreground">{monthNum(p.month)}월분</span>
                  </div>
                  <div className="num text-xs text-muted-foreground">
                    {dotDate(p.date)} · {p.method}
                    {p.memo ? ` · ${p.memo}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => openDialog({ kind: "delete", id: p.id })}
                  aria-label={`${dotDate(p.date)} ${won(p.amount)} 기록 삭제`}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty>수납 기록이 없습니다.</Empty>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={() => openDialog({ kind: "contract", id: c.id })}>
          계약 수정·재계약
        </Button>
        <Button variant="destructive" size="lg" onClick={() => openDialog({ kind: "end", id: c.id })}>
          계약 종료(퇴실)
        </Button>
      </div>
      <Source text={`원본: 「계약」 탭 ${c.row}행 · ${c.id}`} />
      <RoomAdmin room={r} />
    </div>
  )
}

const DEP_TONE: Record<DepositStatus, Tone> = {
  none: "vacant", unpaid: "unpaid", partial: "partial", full: "paid", returning: "late", returned: "vacant",
}

/** 계약의 보증금 입금(계약금·잔금)·반환 현황. 보증금은 돌려줄 돈이라 수익에 넣지 않는다 */
function DepositSection({ contract: c, onlyIfHeld }: { contract: Contract; onlyIfHeld?: boolean }) {
  const { data, openDialog } = useRent()
  const v = depositOf(c, data.deposits)
  if (onlyIfHeld && v.held <= 0) return null
  const legacy = !v.records.length && daysBetween(c.start, data.today) > 60
  const ended = c.status === "종료"
  return (
    <Section
      title={ended ? `보증금 · 직전 계약 ${c.tenant}` : "보증금"}
      aside={<Pill tone={legacy ? "vacant" : DEP_TONE[v.st]}>{legacy ? "입금 기록 없음" : DEPOSIT_LABEL[v.st]}</Pill>}
    >
      <div>
        <KV k="약정 보증금" v={won(c.deposit)} />
        <KV k="입금" v={won(v.received)} />
        {v.returned > 0 && <KV k="반환" v={won(v.returned)} />}
        <KV k={ended || v.returned > 0 ? "돌려줄 보증금" : "남은 금액"} v={won(ended || v.returned > 0 ? v.held : v.remaining)} strong />
      </div>
      {v.records.length > 0 && (
        <div className="divide-y">
          {v.records.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-1.5">
              <div className="num flex-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{d.kind}</span> {won(d.amount)} · {dotDate(d.date)} · {d.method}
                {d.memo ? ` · ${d.memo}` : ""}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => openDialog({ kind: "deleteDeposit", id: d.id })}
                aria-label={`${dotDate(d.date)} 보증금 ${d.kind} ${won(d.amount)} 기록 삭제`}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      {legacy && <p className="text-xs text-muted-foreground">앱을 쓰기 전 계약이면 받은 보증금을 한 번 기록해 두면 퇴실 때 반환 금액을 확인할 수 있습니다.</p>}
      <div className="grid grid-cols-2 gap-2">
        {!ended && v.remaining > 0 && (
          <Button variant="outline" onClick={() => openDialog({ kind: "deposit", contractId: c.id })}>
            <Plus /> 입금 기록
          </Button>
        )}
        {v.held > 0 && (
          <Button variant="outline" onClick={() => openDialog({ kind: "deposit", contractId: c.id, refund: true })}>
            반환 기록
          </Button>
        )}
      </div>
    </Section>
  )
}

/** 호실 자체(호수·층·면적·메모) 관리. 계약·수납 기록이 있으면 삭제 대신 안내만 */
function RoomAdmin({ room: r }: { room: RoomView }) {
  const { data, openDialog } = useRent()
  const used = r.list.length > 0 || data.payments.some((p) => p.roomId === r.id)
  return (
    <section className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">호실 정보</h3>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => openDialog({ kind: "room", id: r.id })}>
            <Pencil /> 수정
          </Button>
          {!used && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => openDialog({ kind: "deleteRoom", id: r.id })}>
              <Trash2 /> 삭제
            </Button>
          )}
        </div>
      </div>
      {r.memo && <p className="text-sm">메모: {r.memo}</p>}
      <Source text={`원본: 「호실」 탭 ${r.row}행 · ${r.id}${used ? " · 계약 기록이 있어 삭제 불가" : ""}`} />
    </section>
  )
}

function Source({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <FileSpreadsheet className="size-3.5" /> {text}
    </p>
  )
}
