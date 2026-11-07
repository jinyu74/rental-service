"use client"

import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { addMonth, monthNum } from "@/lib/format"
import type { Contract } from "@/lib/types"

export type Tone = "paid" | "due" | "unpaid" | "partial" | "vacant" | "late"

export const TONE: Record<Tone, { pill: string; tile: string; dot: string }> = {
  paid: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    tile: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300",
    dot: "bg-emerald-500",
  },
  due: {
    pill: "bg-blue-50 text-blue-700 ring-blue-600/20",
    tile: "border-blue-200 bg-blue-50/60 hover:border-blue-300",
    dot: "bg-blue-500",
  },
  unpaid: {
    pill: "bg-red-50 text-red-700 ring-red-600/20",
    tile: "border-red-300 bg-red-50 hover:border-red-400",
    dot: "bg-red-500",
  },
  partial: {
    pill: "bg-orange-50 text-orange-700 ring-orange-600/20",
    tile: "border-orange-300 bg-orange-50 hover:border-orange-400",
    dot: "bg-orange-500",
  },
  vacant: {
    pill: "bg-slate-100 text-slate-600 ring-slate-500/20",
    tile: "border-dashed border-slate-300 bg-slate-50 hover:border-slate-400",
    dot: "bg-slate-300",
  },
  late: {
    pill: "bg-amber-50 text-amber-800 ring-amber-600/25",
    tile: "border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
  },
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        TONE[tone].pill,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TypeBadge({ contract }: { contract: Contract | null }) {
  if (!contract) return <Pill tone="vacant">공실</Pill>
  return contract.type === "전세" ? (
    <span className="inline-flex h-5 items-center rounded-md bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">전세</span>
  ) : (
    <span className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">월세</span>
  )
}

export function Kpi({
  label,
  value,
  sub,
  tone,
  progress,
}: {
  label: string
  value: string
  sub: string
  tone?: "primary" | "bad"
  progress?: number
}) {
  return (
    <Card className="gap-1.5 px-4 py-4 md:px-5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "num text-xl font-bold tracking-tight md:text-2xl",
          tone === "primary" && "text-primary",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </span>
      {progress != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Card>
  )
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center rounded-lg border bg-card">
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonth(month, -1))} aria-label="이전 달">
        <ChevronLeft />
      </Button>
      <span className="num min-w-24 text-center text-sm font-semibold">
        {month.slice(0, 4)}년 {monthNum(month)}월
      </span>
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonth(month, 1))} aria-label="다음 달">
        <ChevronRight />
      </Button>
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground md:text-sm">{eyebrow}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}
