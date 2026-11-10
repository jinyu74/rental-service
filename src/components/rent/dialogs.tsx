"use client"

import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteBuildingAction,
  deletePaymentAction,
  deleteRoomAction,
  endContractAction,
  recordPaymentAction,
  saveBuildingAction,
  saveContractAction,
  saveRoomAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { roomName } from "@/lib/billing"
import { digits, dotDate, monthNum, parseDate, won, ymd } from "@/lib/format"
import type { ActionResult, ContractType } from "@/lib/types"
import { useRent } from "./rent-app"

/* ───────── 공통: 휴대폰은 아래 시트, PC 는 가운데 대화상자 ───────── */

/** 입력 이벤트가 나지 않는 선택 버튼(Seg 등)이 「작성 중」을 알리는 통로 */
const DirtyCtx = createContext<() => void>(() => {})
/** 입력창이 아닌 버튼으로 값을 바꿀 때 「작성 중」으로 표시하는 함수 (FormShell 안에서만 동작) */
export const useMarkDirty = () => useContext(DirtyCtx)

export function FormShell({
  title,
  description,
  wide,
  onClose,
  onSubmit,
  pending,
  error,
  submitLabel,
  destructive,
  children,
}: {
  title: string
  description?: ReactNode
  wide?: boolean
  onClose: () => void
  onSubmit: () => void
  pending: boolean
  error: string | null
  submitLabel: string
  destructive?: boolean
  children: ReactNode
}) {
  const { isMobile } = useRent()
  // 사용자가 무언가 입력·선택했는지. 작성 중이면 닫기 전에 한 번 묻는다
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const markDirty = () => {
    if (!dirty) setDirty(true)
  }
  const requestClose = () => {
    if (pending) return
    if (dirty) setConfirming(true)
    else onClose()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setConfirming(false)
    onSubmit()
  }
  const body = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </>
  )
  const actions = confirming ? (
    <div role="alertdialog" aria-label="닫기 확인" className="col-span-2 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <p className="text-sm font-medium sm:mr-auto">작성 중인 내용이 있습니다. 닫을까요?</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" size="lg" autoFocus onClick={() => setConfirming(false)}>
          계속 작성
        </Button>
        <Button type="button" variant="destructive" size="lg" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  ) : (
    <>
      <Button type="button" variant="outline" size="lg" onClick={requestClose}>
        취소
      </Button>
      <Button type="submit" size="lg" variant={destructive ? "destructive" : "default"} disabled={pending}>
        {pending ? "저장 중…" : submitLabel}
      </Button>
    </>
  )
  // 배경 누름으로는 닫지 않는다(disablePointerDismissal). Esc·X 는 requestClose 를 거친다
  const onOpenChange = (open: boolean) => !open && requestClose()
  const formProps = { onSubmit: submit, onInput: markDirty, onChange: markDirty, noValidate: true }

  if (isMobile)
    return (
      <DirtyCtx.Provider value={markDirty}>
        <Sheet open onOpenChange={onOpenChange} disablePointerDismissal>
          <SheetContent side="bottom" className="gap-0 overflow-hidden rounded-t-2xl p-0 data-[side=bottom]:max-h-[92dvh]">
            <form {...formProps} className="flex min-h-0 flex-1 flex-col">
              <SheetHeader className="border-b px-5 py-3">
                <SheetTitle>{title}</SheetTitle>
                {description && <SheetDescription>{description}</SheetDescription>}
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{body}</div>
              <SheetFooter className="grid grid-cols-2 border-t px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">{actions}</SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </DirtyCtx.Provider>
    )

  return (
    <DirtyCtx.Provider value={markDirty}>
      <Dialog open onOpenChange={onOpenChange} disablePointerDismissal>
        <DialogContent className={cn("sm:max-w-md", wide && "sm:max-w-2xl")}>
          <form {...formProps} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div>{body}</div>
            <DialogFooter>{actions}</DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DirtyCtx.Provider>
  )
}

export function Field({ label, htmlFor, full, children }: { label: string; htmlFor: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", full && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

export function MoneyInput({ id, value, onChange, autoFocus }: { id: string; value: number | ""; onChange: (n: number | "") => void; autoFocus?: boolean }) {
  return (
    <Input
      id={id}
      autoFocus={autoFocus}
      inputMode="numeric"
      className="num h-10 text-right"
      value={value === "" ? "" : value.toLocaleString("ko-KR")}
      onChange={(e) => {
        const n = digits(e.target.value)
        onChange(e.target.value.trim() === "" ? "" : n)
      }}
    />
  )
}

export function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { v: T; label: string }[]; label: string }) {
  const markDirty = useContext(DirtyCtx)
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(v) => {
        if (!v[0]) return
        markDirty()
        onChange(v[0] as T)
      }}
      variant="outline"
      spacing={0}
      className="w-full"
    >
      {items.map((it) => (
        <ToggleGroupItem
          key={it.v}
          value={it.v}
          className="h-10 flex-1 data-pressed:border-primary data-pressed:bg-accent data-pressed:font-semibold data-pressed:text-accent-foreground"
        >
          {it.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function useSubmit(onClose: () => void) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<ActionResult>) => {
    setError(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) return setError(r.error)
      toast.success(r.message)
      onClose()
    })
  }
  return { pending, error, setError, run }
}

/* ───────── 수납 기록 ───────── */

export function PayDialog({ contractId, onClose }: { contractId?: string; onClose: () => void }) {
  const { data, M, month } = useRent()
  const billable = M.rooms.filter((r) => r.billing)
  let target = contractId ? billable.find((r) => r.billing!.id === contractId) : undefined
  target ??= billable.find((r) => r.bill!.st === "unpaid" || r.bill!.st === "partial") ?? billable.find((r) => r.bill!.st === "due") ?? billable[0]
  const fallback = contractId ? data.contracts.find((c) => c.id === contractId) : undefined
  const initial = target?.billing ?? fallback

  const [cid, setCid] = useState(initial?.id ?? "")
  const [m, setM] = useState(month)
  const suggest = (id: string, mon: string) => {
    const c = data.contracts.find((x) => x.id === id)
    if (!c) return ""
    const s = M.statusFor(c, mon)
    return s.outstanding || s.billed
  }
  const [amount, setAmount] = useState<number | "">(() => suggest(initial?.id ?? "", month))
  const [date, setDate] = useState(data.today)
  const [method, setMethod] = useState("계좌이체")
  const [memo, setMemo] = useState("")
  const { pending, error, run } = useSubmit(onClose)

  const options = billable.some((r) => r.billing!.id === cid)
    ? billable
    : [...billable, ...(fallback ? M.rooms.filter((r) => r.id === fallback.roomId) : [])]

  return (
    <FormShell
      title="수납 기록"
      description="저장하면 시트 「수납내역」 탭에 한 줄이 추가됩니다."
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장하고 시트에 기록"
      onSubmit={() =>
        run(() => recordPaymentAction({ contractId: cid, month: m, amount: amount || 0, date, method, memo: memo.trim() }))
      }
    >
      <Field label="호실 · 임차인" htmlFor="pay-c" full>
        <NativeSelect
          id="pay-c"
          className="w-full"
          value={cid}
          onChange={(e) => {
            setCid(e.target.value)
            setAmount(suggest(e.target.value, m))
          }}
        >
          {!initial && <NativeSelectOption value="">{monthNum(month)}월에 청구할 계약이 없습니다</NativeSelectOption>}
          {options.map((r) => {
            const c = r.billing ?? r.current!
            const out = r.billing ? r.bill!.outstanding : 0
            return (
              <NativeSelectOption key={c.id} value={c.id}>
                {roomName(r)} · {c.tenant} {out ? `(남은 ${won(out)})` : "(완료)"}
              </NativeSelectOption>
            )
          })}
        </NativeSelect>
      </Field>
      <Field label="청구월" htmlFor="pay-m">
        <Input id="pay-m" type="month" className="h-10" value={m} onChange={(e) => { setM(e.target.value); if (e.target.value) setAmount(suggest(cid, e.target.value)) }} />
      </Field>
      <Field label="입금액 (원)" htmlFor="pay-a">
        <MoneyInput id="pay-a" value={amount} onChange={setAmount} />
      </Field>
      <Field label="입금일" htmlFor="pay-d">
        <Input id="pay-d" type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">방법</span>
        <Seg label="방법" value={method} onChange={setMethod} items={["계좌이체", "현금", "기타"].map((v) => ({ v, label: v }))} />
      </div>
      <Field label="메모 (선택)" htmlFor="pay-memo" full>
        <Input id="pay-memo" className="h-10" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 일부 입금, 입금자명 다름" />
      </Field>
    </FormShell>
  )
}

/* ───────── 계약 등록 / 수정 ───────── */

export function ContractDialog({ id, roomId: presetRoom, onClose }: { id?: string; roomId?: string; onClose: () => void }) {
  const { data, M } = useRent()
  const editing = id ? data.contracts.find((c) => c.id === id) : undefined
  const initRoom = editing?.roomId ?? presetRoom ?? ""
  const prev = !editing && initRoom
    ? data.contracts.filter((c) => c.roomId === initRoom).sort((a, b) => b.start.localeCompare(a.start))[0]
    : undefined
  const base = editing ?? prev
  const start0 = editing?.start ?? data.today
  const s0 = parseDate(start0)

  const [roomId, setRoomId] = useState(initRoom)
  const [tenant, setTenant] = useState(editing?.tenant ?? "")
  const [phone, setPhone] = useState(editing?.phone ?? "")
  const [type, setType] = useState<ContractType>(base?.type ?? "월세")
  const [deposit, setDeposit] = useState<number | "">(base?.deposit ?? "")
  const [rent, setRent] = useState<number | "">(base?.rent || "")
  const [fee, setFee] = useState<number | "">(base?.fee ?? "")
  const [payDay, setPayDay] = useState(String(base?.payDay ?? 5))
  const [start, setStart] = useState(start0)
  const [end, setEnd] = useState(editing?.end ?? ymd(new Date(s0.getFullYear() + 2, s0.getMonth(), s0.getDate() - 1)))
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormShell
      wide
      title={editing ? "계약 수정" : "새 계약 등록"}
      description={editing ? "재계약은 기간·금액을 고쳐 저장하거나, 기존 계약을 종료한 뒤 새로 등록하세요." : "저장하면 시트 「계약」 탭에 추가됩니다."}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={() =>
        run(() =>
          saveContractAction({
            id: editing?.id,
            roomId,
            tenant,
            phone,
            type,
            deposit: deposit || 0,
            rent: type === "전세" ? 0 : rent || 0,
            fee: fee || 0,
            payDay: Number(payDay) || 1,
            start,
            end,
            memo,
          }),
        )
      }
    >
      <Field label="호실" htmlFor="ct-room" full>
        <NativeSelect id="ct-room" className="w-full" value={roomId} disabled={!!editing} onChange={(e) => setRoomId(e.target.value)}>
          <NativeSelectOption value="">호실 선택</NativeSelectOption>
          {data.buildings.map((b) => (
            <NativeSelectOptGroup key={b.id} label={b.name}>
              {M.rooms
                .filter((r) => r.buildingId === b.id)
                .map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.no}호 · {r.occupied ? r.current!.tenant : "공실"}
                  </NativeSelectOption>
                ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </Field>
      <Field label="임차인" htmlFor="ct-t">
        <Input id="ct-t" className="h-10" autoComplete="off" value={tenant} onChange={(e) => setTenant(e.target.value)} />
      </Field>
      <Field label="연락처" htmlFor="ct-p">
        <Input id="ct-p" className="h-10" type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div className="grid gap-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">유형</span>
        <Seg label="계약 유형" value={type} onChange={setType}
          items={[{ v: "월세", label: "월세 (임대료+관리비)" }, { v: "전세", label: "전세 (관리비만 청구)" }]} />
      </div>
      <Field label="보증금 (원)" htmlFor="ct-dep">
        <MoneyInput id="ct-dep" value={deposit} onChange={setDeposit} />
      </Field>
      {type === "월세" && (
        <Field label="월 임대료 (원)" htmlFor="ct-rent">
          <MoneyInput id="ct-rent" value={rent} onChange={setRent} />
        </Field>
      )}
      <Field label="월 관리비 (원)" htmlFor="ct-fee">
        <MoneyInput id="ct-fee" value={fee} onChange={setFee} />
      </Field>
      <Field label="납부일 (매월)" htmlFor="ct-day">
        <Input id="ct-day" type="number" min={1} max={31} className="h-10" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
      </Field>
      <Field label="시작일" htmlFor="ct-s">
        <Input id="ct-s" type="date" className="h-10" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="종료일" htmlFor="ct-e">
        <Input id="ct-e" type="date" className="h-10" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="메모 (선택)" htmlFor="ct-memo" full>
        <Textarea id="ct-memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </FormShell>
  )
}

/* ───────── 계약 종료 ───────── */

export function EndContractDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, M } = useRent()
  const c = data.contracts.find((x) => x.id === id)
  const r = c ? M.rooms.find((x) => x.id === c.roomId) : undefined
  const [end, setEnd] = useState(c && c.end < data.today ? c.end : data.today)
  const { pending, error, run } = useSubmit(onClose)
  if (!c) return null
  return (
    <FormShell
      title="계약 종료 (퇴실)"
      description={`${r ? roomName(r) : c.roomId} · ${c.tenant}`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="종료 처리"
      onSubmit={() => run(() => endContractAction(id, end))}
    >
      <Field label="퇴실일 (계약 종료일)" htmlFor="end-d" full>
        <Input id="end-d" type="date" className="h-10" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <p className="text-sm text-muted-foreground sm:col-span-2">
        상태가 「종료」로 바뀌고 이 호실은 공실이 됩니다. 보증금을 돌려주면 호실 상세의 「보증금」에서 반환을 기록하세요.
      </p>
    </FormShell>
  )
}

/* ───────── 수납 기록 삭제 ───────── */

export function DeletePaymentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const p = data.payments.find((x) => x.id === id)
  const { pending, error, run } = useSubmit(onClose)
  if (!p) return null
  return (
    <FormShell
      title="수납 기록 삭제"
      description={`${dotDate(p.date)} · ${won(p.amount)} · ${monthNum(p.month)}월분`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="삭제"
      destructive
      onSubmit={() => run(() => deletePaymentAction(id))}
    >
      <p className="text-sm text-muted-foreground sm:col-span-2">시트 「수납내역」 탭에서 이 행이 삭제됩니다.</p>
    </FormShell>
  )
}

/* ───────── 건물 관리 (목록) ───────── */

export function BuildingsDialog({ onClose }: { onClose: () => void }) {
  const { data, openDialog } = useRent()
  const count = (id: string) => data.rooms.filter((r) => r.buildingId === id).length
  return (
    <FormShell
      title="건물 관리"
      description="건물 이름·주소를 고치거나 새 건물을 추가합니다. 호실이 남아 있는 건물은 삭제할 수 없습니다."
      onClose={onClose}
      pending={false}
      error={null}
      submitLabel="건물 추가"
      onSubmit={() => openDialog({ kind: "building" })}
    >
      <ul className="divide-y rounded-lg border sm:col-span-2">
        {data.buildings.map((b) => (
          <li key={b.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {b.name} <span className="text-xs font-normal text-muted-foreground">{b.id} · {count(b.id)}실</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{b.address || "주소 없음"}</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`${b.name} 수정`} onClick={() => openDialog({ kind: "building", id: b.id })}>
              <Pencil />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`${b.name} 삭제`} disabled={count(b.id) > 0}
              onClick={() => openDialog({ kind: "deleteBuilding", id: b.id })}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </FormShell>
  )
}

/* ───────── 건물 추가 / 수정 ───────── */

export function BuildingDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data } = useRent()
  const editing = id ? data.buildings.find((b) => b.id === id) : undefined
  const [code, setCode] = useState(editing?.id ?? "")
  const [name, setName] = useState(editing?.name ?? "")
  const [address, setAddress] = useState(editing?.address ?? "")
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, run } = useSubmit(onClose)
  return (
    <FormShell
      title={editing ? "건물 정보 수정" : "건물 추가"}
      description="저장하면 시트 「건물」 탭에 반영됩니다."
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={() => run(() => saveBuildingAction({ id: editing?.id, code, name, address, memo }))}
    >
      <Field label="건물명" htmlFor="bd-name">
        <Input id="bd-name" className="h-10" autoComplete="off" placeholder="예: 원주건물" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={editing ? "건물 코드 (변경 불가)" : "건물 코드 (영문 대문자·숫자)"} htmlFor="bd-code">
        <Input id="bd-code" className="h-10 uppercase" autoComplete="off" placeholder="예: WJ" maxLength={6} disabled={!!editing}
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </Field>
      <Field label="주소 (선택)" htmlFor="bd-addr" full>
        <Input id="bd-addr" className="h-10" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="메모 (선택)" htmlFor="bd-memo" full>
        <Input id="bd-memo" className="h-10" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      {!editing && (
        <p className="text-xs text-muted-foreground sm:col-span-2">건물 코드는 호실ID 앞부분이 됩니다(예: WJ-101). 저장 후에는 바꿀 수 없습니다.</p>
      )}
    </FormShell>
  )
}

export function DeleteBuildingDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const b = data.buildings.find((x) => x.id === id)
  const { pending, error, run } = useSubmit(onClose)
  if (!b) return null
  return (
    <FormShell
      title="건물 삭제"
      description={`${b.name} (${b.id})`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="삭제"
      destructive
      onSubmit={() => run(() => deleteBuildingAction(id))}
    >
      <p className="text-sm text-muted-foreground sm:col-span-2">시트 「건물」 탭에서 이 행이 삭제됩니다.</p>
    </FormShell>
  )
}

/* ───────── 호실 추가 / 수정 ───────── */

/** "301" → 3, "1201" → 12, "B01" → -1 */
function floorFromNo(no: string) {
  const t = no.trim().toUpperCase()
  const b = t.match(/^B(\d)\d*$/)
  if (b) return -(Number(b[1]) || 1)
  if (/^\d{3,4}$/.test(t)) return Number(t.slice(0, -2))
  return null
}

export function RoomDialog({ id, buildingId: presetBuilding, onClose }: { id?: string; buildingId?: string; onClose: () => void }) {
  const { data } = useRent()
  const editing = id ? data.rooms.find((r) => r.id === id) : undefined
  const [buildingId, setBuildingId] = useState(editing?.buildingId ?? presetBuilding ?? data.buildings[0]?.id ?? "")
  const [no, setNo] = useState(editing?.no ?? "")
  const [floor, setFloor] = useState(editing ? String(editing.floor) : "")
  const [floorTouched, setFloorTouched] = useState(!!editing)
  const [area, setArea] = useState(editing?.area != null ? String(editing.area) : "")
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, setError, run } = useSubmit(onClose)

  const submit = () => {
    const f = Number(floor)
    if (floor.trim() === "" || !Number.isInteger(f)) return setError("층을 숫자로 입력하세요. 지하는 -1 처럼 입력합니다.")
    const a = area.trim() === "" ? null : Number(area)
    if (a != null && Number.isNaN(a)) return setError("면적은 숫자로 입력하세요.")
    run(() => saveRoomAction({ id: editing?.id, buildingId, no, floor: f, area: a, memo }))
  }

  return (
    <FormShell
      title={editing ? "호실 정보 수정" : "호실 추가"}
      description={editing ? `호실ID ${editing.id} 는 계약·수납 기록과 연결돼 있어 바뀌지 않습니다.` : "저장하면 시트 「호실」 탭에 추가됩니다."}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={submit}
    >
      <Field label="건물" htmlFor="rm-b" full>
        <NativeSelect id="rm-b" className="w-full" value={buildingId} disabled={!!editing} onChange={(e) => setBuildingId(e.target.value)}>
          {data.buildings.map((b) => (
            <NativeSelectOption key={b.id} value={b.id}>
              {b.name} ({b.id})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="호수" htmlFor="rm-no">
        <Input id="rm-no" className="h-10" autoComplete="off" placeholder="예: 301" value={no}
          onChange={(e) => {
            setNo(e.target.value)
            const f = floorFromNo(e.target.value)
            if (!floorTouched && f != null) setFloor(String(f))
          }} />
      </Field>
      <Field label="층" htmlFor="rm-f">
        <Input id="rm-f" type="number" inputMode="numeric" className="h-10" value={floor}
          onChange={(e) => { setFloor(e.target.value); setFloorTouched(true) }} />
      </Field>
      <Field label="면적 ㎡ (선택)" htmlFor="rm-a">
        <Input id="rm-a" inputMode="decimal" className="h-10" value={area} onChange={(e) => setArea(e.target.value)} />
      </Field>
      <Field label="메모 (선택)" htmlFor="rm-memo">
        <Input id="rm-memo" className="h-10" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
      {!editing && buildingId && no.trim() && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          호실ID: <span className="num font-medium text-foreground">{buildingId}-{no.trim().toUpperCase()}</span>
        </p>
      )}
    </FormShell>
  )
}

export function DeleteRoomDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { M } = useRent()
  const r = M.rooms.find((x) => x.id === id)
  const { pending, error, run } = useSubmit(onClose)
  if (!r) return null
  return (
    <FormShell
      title="호실 삭제"
      description={`${roomName(r)} (${r.id})`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="삭제"
      destructive
      onSubmit={() => run(() => deleteRoomAction(id))}
    >
      <p className="text-sm text-muted-foreground sm:col-span-2">시트 「호실」 탭에서 이 행이 삭제됩니다. 계약 기록이 없는 호실만 삭제할 수 있습니다.</p>
    </FormShell>
  )
}
