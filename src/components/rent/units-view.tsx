"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, DoorOpen, Handshake, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { billOf, isAlert, roomName, statusLabel, type RoomView } from "@/lib/billing"
import { daysBetween, ddayText, dotDate, man, monthNum, won } from "@/lib/format"
import { Empty, MonthSwitcher, PageHeader, Pill, TypeBadge, type Tone } from "./bits"
import { RoomDetail } from "./room-detail"
import { useRent } from "./rent-app"

const toneOf = (r: RoomView): Tone => (r.bill ? r.bill.st : "vacant")

function Chips({ label, value, onChange, items }: {
  label: string
  value: string
  onChange: (v: string) => void
  items: { v: string; label: string; n?: number }[]
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0])}
      variant="outline"
      size="sm"
      spacing={1}
      className="flex-wrap"
    >
      {items.map((it) => (
        <ToggleGroupItem
          key={it.v}
          value={it.v}
          className="rounded-full bg-card px-3 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
        >
          {it.label}
          {it.n != null && <span className="num ml-1 opacity-70">{it.n}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function UnitsView() {
  const { data, M, month, setMonth, selected, setSelected, openRoom, openDialog, isCompact } = useRent()
  const [bf, setBf] = useState("all")
  const [tf, setTf] = useState("all")
  const [sf, setSf] = useState("all")
  const [q, setQ] = useState("")
  const mm = monthNum(month)

  const inBuilding = M.rooms.filter((r) => bf === "all" || r.buildingId === bf)
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return M.rooms.filter((r) => {
      if (bf !== "all" && r.buildingId !== bf) return false
      const c = r.current
      if (tf === "공실" && r.occupied) return false
      if ((tf === "월세" || tf === "전세") && c?.type !== tf) return false
      if (sf !== "all") {
        const st = toneOf(r)
        if (sf === "unpaid" ? !isAlert(r) : st !== sf) return false
      }
      if (needle) {
        const hay = [r.no, roomName(r), c?.tenant ?? "", c?.phone ?? ""].join(" ").toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [M.rooms, bf, tf, sf, q])

  // 데스크톱: 선택된 호실이 없으면 첫 미납(없으면 첫 호실) 선택
  useEffect(() => {
    if (isCompact) return
    if (!selected || !M.rooms.some((r) => r.id === selected)) {
      const first = rows.find(isAlert) ?? rows[0]
      if (first) setSelected(first.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact, selected, M.rooms])

  const cnt = (f: (r: RoomView) => boolean) => inBuilding.filter(f).length
  const sel = M.rooms.find((r) => r.id === selected)

  return (
    <>
      <PageHeader
        eyebrow={data.buildings.map((b) => `${b.name} ${M.rooms.filter((r) => r.buildingId === b.id).length}실`).join(" · ")}
        title="호실·계약 관리"
      >
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button variant="outline" size="lg" aria-label="건물 관리" title="건물 관리" onClick={() => openDialog({ kind: "buildings" })}>
          <Building2 /> <span className="hidden sm:inline">건물 관리</span>
        </Button>
        <Button variant="outline" size="lg" aria-label="중개소 관리" title="중개소 관리" onClick={() => openDialog({ kind: "brokers" })}>
          <Handshake /> <span className="hidden sm:inline">중개소</span>
        </Button>
        <Button variant="outline" size="lg" aria-label="호실 추가" title="호실 추가"
          onClick={() => openDialog({ kind: "room", buildingId: bf === "all" ? undefined : bf })}>
          <DoorOpen /> <span className="hidden sm:inline">호실 추가</span>
        </Button>
        <Button size="lg" onClick={() => openDialog({ kind: "contract" })}>
          <Plus /> 새 계약
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <Chips label="건물" value={bf} onChange={setBf}
          items={[{ v: "all", label: "전체", n: M.rooms.length }, ...data.buildings.map((b) => ({ v: b.id, label: b.name, n: M.rooms.filter((r) => r.buildingId === b.id).length }))]} />
        <Chips label="계약 유형" value={tf} onChange={setTf}
          items={[
            { v: "all", label: "전체 유형" },
            { v: "월세", label: "월세", n: cnt((r) => r.current?.type === "월세") },
            { v: "전세", label: "전세", n: cnt((r) => r.current?.type === "전세") },
            { v: "공실", label: "공실", n: cnt((r) => !r.occupied) },
          ]} />
        <Chips label="수납 상태" value={sf} onChange={setSf}
          items={[
            { v: "all", label: "전체 상태" },
            { v: "unpaid", label: "미납", n: cnt(isAlert) },
            { v: "due", label: "납부예정", n: cnt((r) => toneOf(r) === "due") },
            { v: "paid", label: "수납완료", n: cnt((r) => toneOf(r) === "paid") },
          ]} />
        <label className="relative lg:ml-auto lg:w-64">
          <span className="sr-only">임차인 또는 호실 검색</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="임차인, 호실, 연락처 검색" className="h-9 bg-card pl-8" />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section>
          <Card className="hidden gap-0 py-0 md:flex">
            <div className="flex items-center justify-between border-b px-5 py-3 text-sm">
              <span className="font-semibold">{rows.length}개 호실</span>
              <span className="text-muted-foreground">
                월 청구 합계 <b className="num text-foreground">{won(rows.reduce((a, r) => a + (r.current ? billOf(r.current) : 0), 0))}</b>
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-5">호실</TableHead>
                  <TableHead>임차인</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-right">보증금</TableHead>
                  <TableHead className="text-right">월 청구액</TableHead>
                  <TableHead>계약 만료</TableHead>
                  <TableHead className="pr-5">{mm}월 수납</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const c = r.current
                  const dd = c ? daysBetween(data.today, c.end) : 0
                  return (
                    <TableRow
                      key={r.id}
                      data-state={r.id === selected ? "selected" : undefined}
                      className="cursor-pointer data-[state=selected]:bg-accent"
                      onClick={() => openRoom(r.id)}
                    >
                      <TableCell className="pl-5">
                        <button type="button" className="text-left focus-visible:outline-none" onClick={(e) => { e.stopPropagation(); openRoom(r.id) }}>
                          <span className="block font-semibold">{r.no}호</span>
                          <span className="text-xs text-muted-foreground">{r.building.name}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c?.tenant ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c ? c.phone : "입주자 모집 중"}</div>
                      </TableCell>
                      <TableCell><TypeBadge contract={c} /></TableCell>
                      <TableCell className="num text-right">{c ? man(c.deposit) : "—"}</TableCell>
                      <TableCell className="num text-right">
                        <div className="font-semibold">{c ? won(billOf(c)) : "—"}</div>
                        {c && (
                          <div className="text-xs text-muted-foreground">
                            {c.type === "전세" ? "관리비만" : `임대 ${man(c.rent).replace("원", "")} + 관리 ${man(c.fee).replace("원", "")}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="num">
                        <div>{c ? dotDate(c.end) : "—"}</div>
                        {c && <div className={cn("text-xs font-semibold", dd <= 90 ? "text-warn" : "text-muted-foreground")}>{ddayText(dd)}</div>}
                      </TableCell>
                      <TableCell className="pr-5"><Pill tone={toneOf(r)}>{statusLabel(r)}</Pill></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {!rows.length && <Empty>조건에 맞는 호실이 없습니다.</Empty>}
          </Card>

          {/* 모바일 카드 목록 */}
          <div className="space-y-2.5 md:hidden">
            <p className="px-1 text-sm text-muted-foreground">{rows.length}개 호실</p>
            {rows.map((r) => {
              const c = r.current
              const dd = c ? daysBetween(data.today, c.end) : 0
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openRoom(r.id)}
                  data-alert={isAlert(r) || undefined}
                  className="unit-card w-full rounded-xl border bg-card p-4 text-left shadow-xs data-alert:border-red-300 data-alert:bg-red-50/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-bold">{roomName(r)}</span>
                      <TypeBadge contract={c} />
                    </span>
                    <Pill tone={toneOf(r)}>{statusLabel(r)}</Pill>
                  </span>
                  <span className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c?.tenant ?? "입주자 모집 중"}</span>
                    <span className="num font-semibold">{c ? won(billOf(c)) : "—"}</span>
                  </span>
                  {c && (
                    <span className="num mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>매월 {c.payDay}일 · {c.type === "전세" ? "관리비만" : "임대료+관리비"}</span>
                      <span className={cn("font-semibold", dd <= 90 && "text-warn")}>{dd < 0 ? ddayText(dd) : `만료 ${ddayText(dd)}`}</span>
                    </span>
                  )}
                </button>
              )
            })}
            {!rows.length && <Empty>조건에 맞는 호실이 없습니다.</Empty>}
          </div>
        </section>

        <aside className="hidden lg:block">
          <Card className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto px-5">
            {sel ? <RoomDetail room={sel} /> : <Empty>호실을 선택하세요.</Empty>}
          </Card>
        </aside>
      </div>
    </>
  )
}
