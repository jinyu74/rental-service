"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import {
  deleteDepositAction,
  deleteExpenseAction,
  deleteFixedCostAction,
  recordDepositAction,
  recordFixedRunAction,
  saveExpenseAction,
  saveFixedCostAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { roomName } from "@/lib/billing"
import { EXPENSE_ITEMS } from "@/lib/data/schema"
import { depositOf, fixedStatus } from "@/lib/finance"
import { dotDate, monthEnd, monthNum, won } from "@/lib/format"
import type { ActionResult, DepositKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Field, FormShell, MoneyInput, Seg, useSubmit } from "./dialogs"
import { useRent } from "./rent-app"

/** 이 달에 기록할 때 기본 날짜: 이번 달이면 오늘, 아니면 그달 말일 */
const defaultDate = (today: string, month: string) => (today.startsWith(month) ? today : monthEnd(month))

function ItemList() {
  return (
    <datalist id="expense-items">
      {EXPENSE_ITEMS.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )
}

/* ───────── 보증금 입금·반환 ───────── */

export function DepositDialog({ contractId, refund, onClose }: { contractId: string; refund?: boolean; onClose: () => void }) {
  const { data, M } = useRent()
  const c = data.contracts.find((x) => x.id === contractId)
  const v = c ? depositOf(c, data.deposits) : null
  const firstKind: DepositKind = refund ? "반환" : v && v.received > 0 ? "잔금" : "계약금"
  const suggest = (k: DepositKind) => {
    if (!v) return "" as const
    if (k === "반환") return v.held || ""
    if (k === "계약금") return Math.min(v.remaining, Math.round(v.contract.deposit / 10)) || ""
    return v.remaining || ""
  }
  const [kind, setKind] = useState<DepositKind>(firstKind)
  const [amount, setAmount] = useState<number | "">(() => suggest(firstKind))
  const [date, setDate] = useState(data.today)
  const [method, setMethod] = useState("계좌이체")
  const [memo, setMemo] = useState("")
  const { pending, error, run } = useSubmit(onClose)
  if (!c || !v) return null
  const r = M.rooms.find((x) => x.id === c.roomId)

  return (
    <FormShell
      title={kind === "반환" ? "보증금 반환 기록" : "보증금 입금 기록"}
      description={`${r ? roomName(r) : c.roomId} · ${c.tenant} · 약정 ${won(c.deposit)}`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장하고 시트에 기록"
      onSubmit={() => run(() => recordDepositAction({ contractId, kind, amount: amount || 0, date, method, memo }))}
    >
      <div className="num grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center text-xs sm:col-span-2">
        <div>
          <div className="text-muted-foreground">입금</div>
          <div className="text-sm font-semibold">{won(v.received)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">남은 금액</div>
          <div className={cn("text-sm font-semibold", v.remaining > 0 && "text-bad")}>{won(v.remaining)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">반환</div>
          <div className="text-sm font-semibold">{won(v.returned)}</div>
        </div>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">구분</span>
        <Seg
          label="보증금 구분"
          value={kind}
          onChange={(k) => {
            setKind(k)
            setAmount(suggest(k))
          }}
          items={[
            { v: "계약금", label: "계약금" },
            { v: "잔금", label: "잔금" },
            { v: "반환", label: "반환(퇴실)" },
          ]}
        />
      </div>
      <Field label={kind === "반환" ? "돌려준 금액 (원)" : "입금액 (원)"} htmlFor="dp-a">
        <MoneyInput id="dp-a" value={amount} onChange={setAmount} />
      </Field>
      <Field label={kind === "반환" ? "반환일" : "입금일"} htmlFor="dp-d">
        <Input id="dp-d" type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid gap-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">방법</span>
        <Seg label="방법" value={method} onChange={setMethod} items={["계좌이체", "현금", "기타"].map((x) => ({ v: x, label: x }))} />
      </div>
      <Field label="메모 (선택)" htmlFor="dp-memo" full>
        <Input id="dp-memo" className="h-10" value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder={kind === "반환" ? "예: 청소비 10만원 공제 후 반환" : "예: 입금자명 다름"} />
      </Field>
    </FormShell>
  )
}

/* ───────── 지출 기록 / 수정 ───────── */

export function ExpenseDialog({ id, buildingId: preset, onClose }: { id?: string; buildingId?: string; onClose: () => void }) {
  const { data, month } = useRent()
  const editing = id ? data.expenses.find((e) => e.id === id) : undefined
  const [buildingId, setBuildingId] = useState(editing?.buildingId ?? preset ?? data.buildings[0]?.id ?? "")
  const [m, setM] = useState(editing?.month ?? month)
  const [item, setItem] = useState(editing?.item ?? "")
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "")
  const [date, setDate] = useState(editing?.date ?? defaultDate(data.today, month))
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormShell
      title={editing ? "지출 수정" : "지출 기록"}
      description={editing ? `원본: 「지출내역」 탭 ${editing.row}행` : "하자 보수·소모품 등 그때그때 나간 돈을 기록합니다. 저장하면 시트 「지출내역」 탭에 추가됩니다."}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={() => run(() => saveExpenseAction({ id: editing?.id, buildingId, month: m, item, amount: amount || 0, date, memo }))}
    >
      <Field label="건물" htmlFor="ex-b">
        <NativeSelect id="ex-b" className="w-full" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
          {data.buildings.map((b) => (
            <NativeSelectOption key={b.id} value={b.id}>
              {b.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="귀속월 (어느 달 지출로 볼지)" htmlFor="ex-m">
        <Input id="ex-m" type="month" className="h-10" value={m} onChange={(e) => setM(e.target.value)} />
      </Field>
      <Field label="항목" htmlFor="ex-i">
        <Input id="ex-i" className="h-10" list="expense-items" autoComplete="off" placeholder="예: 수선·하자보수" value={item} onChange={(e) => setItem(e.target.value)} />
        <ItemList />
      </Field>
      <Field label="금액 (원)" htmlFor="ex-a">
        <MoneyInput id="ex-a" value={amount} onChange={setAmount} />
      </Field>
      <Field label="지출일" htmlFor="ex-d">
        <Input id="ex-d" type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="내용 (선택)" htmlFor="ex-memo">
        <Input id="ex-memo" className="h-10" placeholder="예: 302호 보일러 배관 수리" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </FormShell>
  )
}

/* ───────── 이번 달 정기 지출 한 번에 기록 ───────── */

export function FixedRunDialog({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  const { data, month, openDialog } = useRent()
  const b = data.buildings.find((x) => x.id === buildingId)
  const list = fixedStatus(data, buildingId, month)
  const open = list.filter((x) => !x.done)
  const [checked, setChecked] = useState(() => new Set(open.map((x) => x.fixed.id)))
  const [amounts, setAmounts] = useState<Record<string, number | "">>(() =>
    Object.fromEntries(open.map((x) => [x.fixed.id, x.suggest || ""])),
  )
  const [date, setDate] = useState(defaultDate(data.today, month))
  const { pending, error, run } = useSubmit(onClose)
  const picked = open.filter((x) => checked.has(x.fixed.id))
  const total = picked.reduce((a, x) => a + (Number(amounts[x.fixed.id]) || 0), 0)

  if (!list.length)
    return (
      <FormShell
        title={`${b?.name ?? buildingId} 정기 지출`}
        description="등록된 정기 항목이 없습니다. 공용전기·청소·인터넷+TV·수도처럼 매달 나가는 항목을 먼저 등록하세요."
        onClose={onClose}
        pending={false}
        error={null}
        submitLabel="정기 항목 등록"
        onSubmit={() => openDialog({ kind: "fixedList", buildingId })}
      >
        <p className="text-sm text-muted-foreground sm:col-span-2">항목과 기본 금액을 한 번 등록해 두면, 매달 금액만 확인해서 한꺼번에 기록할 수 있습니다.</p>
      </FormShell>
    )

  return (
    <FormShell
      title={`${b?.name ?? buildingId} · ${monthNum(month)}월 정기 지출`}
      description="이번 달 고지 금액으로 고친 뒤 저장하세요. 금액은 지난 기록(없으면 기본 금액)으로 채워져 있습니다."
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel={picked.length ? `${picked.length}건 · ${won(total)} 기록` : "기록할 항목 없음"}
      onSubmit={() =>
        run(() =>
          recordFixedRunAction({
            buildingId,
            month,
            date,
            items: picked.map((x) => ({ fixedId: x.fixed.id, amount: Number(amounts[x.fixed.id]) || 0 })),
          }),
        )
      }
    >
      <ul className="divide-y rounded-lg border sm:col-span-2">
        {list.map(({ fixed: f, done, lastMonth }) => (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              id={`fx-${f.id}`}
              className="size-4 accent-primary"
              disabled={!!done}
              checked={!!done || checked.has(f.id)}
              onChange={(e) => {
                const s = new Set(checked)
                if (e.target.checked) s.add(f.id)
                else s.delete(f.id)
                setChecked(s)
              }}
            />
            <label htmlFor={`fx-${f.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.item}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {done ? `기록됨 · ${dotDate(done.date)}` : lastMonth ? `${monthNum(lastMonth)}월 기준 금액` : "기본 금액"}
              </span>
            </label>
            {done ? (
              <span className="num w-32 text-right text-sm text-muted-foreground">{won(done.amount)}</span>
            ) : (
              <div className="w-32">
                <MoneyInput id={`fx-a-${f.id}`} value={amounts[f.id] ?? ""} onChange={(n) => setAmounts({ ...amounts, [f.id]: n })} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <Field label="지출일" htmlFor="fx-d">
        <Input id="fx-d" type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex items-end">
        <Button type="button" variant="link" className="px-0" onClick={() => openDialog({ kind: "fixedList", buildingId })}>
          정기 항목 관리
        </Button>
      </div>
    </FormShell>
  )
}

/* ───────── 정기 항목 관리 ───────── */

export function FixedListDialog({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  const { data, openDialog } = useRent()
  const b = data.buildings.find((x) => x.id === buildingId)
  const list = data.fixedCosts.filter((f) => f.buildingId === buildingId)
  return (
    <FormShell
      title={`${b?.name ?? buildingId} 정기 지출 항목`}
      description="매달 나가는 돈(관리비로 관리인이 내는 공용전기·청소·인터넷+TV·수도 등)을 등록합니다."
      onClose={onClose}
      pending={false}
      error={null}
      submitLabel="항목 추가"
      onSubmit={() => openDialog({ kind: "fixedItem", buildingId })}
    >
      {list.length ? (
        <ul className="divide-y rounded-lg border sm:col-span-2">
          {list.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.item}</p>
                <p className="num truncate text-xs text-muted-foreground">
                  기본 {won(f.amount)}
                  {f.memo ? ` · ${f.memo}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${f.item} 수정`} onClick={() => openDialog({ kind: "fixedItem", id: f.id, buildingId })}>
                <Pencil />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${f.item} 삭제`} onClick={() => openDialog({ kind: "deleteFixed", id: f.id })}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">아직 등록된 항목이 없습니다.</p>
      )}
    </FormShell>
  )
}

export function FixedItemDialog({ id, buildingId, onClose }: { id?: string; buildingId: string; onClose: () => void }) {
  const { data } = useRent()
  const editing = id ? data.fixedCosts.find((f) => f.id === id) : undefined
  const [item, setItem] = useState(editing?.item ?? "")
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "")
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, run } = useSubmit(onClose)
  const b = data.buildings.find((x) => x.id === buildingId)
  return (
    <FormShell
      title={editing ? "정기 항목 수정" : "정기 항목 추가"}
      description={`${b?.name ?? buildingId} · 기본 금액은 매달 기록할 때 바꿀 수 있습니다.`}
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={() => run(() => saveFixedCostAction({ id: editing?.id, buildingId, item, amount: amount || 0, memo }))}
    >
      <Field label="항목" htmlFor="fi-i">
        <Input id="fi-i" className="h-10" list="expense-items" autoComplete="off" placeholder="예: 공용전기" value={item} onChange={(e) => setItem(e.target.value)} />
        <ItemList />
      </Field>
      <Field label="기본 금액 (원)" htmlFor="fi-a">
        <MoneyInput id="fi-a" value={amount} onChange={setAmount} />
      </Field>
      <Field label="메모 (선택)" htmlFor="fi-memo" full>
        <Input id="fi-memo" className="h-10" placeholder="예: 한전 고객번호, 납부 계좌" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </FormShell>
  )
}

/* ───────── 삭제 확인 ───────── */

function ConfirmDelete({ title, description, note, action, onClose }: {
  title: string; description: string; note: string; action: () => Promise<ActionResult>; onClose: () => void
}) {
  const { pending, error, run } = useSubmit(onClose)
  return (
    <FormShell title={title} description={description} onClose={onClose} pending={pending} error={error} submitLabel="삭제" destructive onSubmit={() => run(action)}>
      <p className="text-sm text-muted-foreground sm:col-span-2">{note}</p>
    </FormShell>
  )
}

export function DeleteDepositDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const d = data.deposits.find((x) => x.id === id)
  if (!d) return null
  return (
    <ConfirmDelete title="보증금 기록 삭제" description={`${dotDate(d.date)} · ${d.kind} ${won(d.amount)}`}
      note="시트 「보증금내역」 탭에서 이 행이 삭제됩니다." action={() => deleteDepositAction(id)} onClose={onClose} />
  )
}

export function DeleteExpenseDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const e = data.expenses.find((x) => x.id === id)
  if (!e) return null
  return (
    <ConfirmDelete title="지출 기록 삭제" description={`${dotDate(e.date)} · ${e.item} ${won(e.amount)}`}
      note="시트 「지출내역」 탭에서 이 행이 삭제됩니다." action={() => deleteExpenseAction(id)} onClose={onClose} />
  )
}

export function DeleteFixedDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const f = data.fixedCosts.find((x) => x.id === id)
  if (!f) return null
  return (
    <ConfirmDelete title="정기 항목 삭제" description={`${f.item} · 기본 ${won(f.amount)}`}
      note="앞으로 정기 지출 목록에서 빠집니다. 이미 기록한 지출은 그대로 남습니다." action={() => deleteFixedCostAction(id)} onClose={onClose} />
  )
}

