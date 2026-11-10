"use client"

import { useState } from "react"
import { Pencil, Phone, Trash2 } from "lucide-react"
import { deleteBrokerAction, saveBrokerAction } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { won } from "@/lib/format"
import type { AppData, Broker, Contract } from "@/lib/types"
import { Field, FormShell, useSubmit } from "./dialogs"
import { ConfirmDelete } from "./finance-dialogs"
import { useRent } from "./rent-app"

/** 계약에 연결된 중개소(현재 이름). 목록에서 지워졌으면 계약에 적어 둔 이름으로 보여 준다 */
export function brokerOf(c: Contract, brokers: Broker[]) {
  if (!c.brokerId && !c.brokerName) return null
  const b = brokers.find((x) => x.id === c.brokerId)
  return { id: c.brokerId, name: b?.name ?? c.brokerName, phone: b?.phone ?? "", fee: c.brokerFee }
}

export function brokerStats(data: AppData, id: string) {
  const list = data.contracts.filter((c) => c.brokerId === id)
  return { count: list.length, fees: list.reduce((a, c) => a + c.brokerFee, 0) }
}

/* ───────── 중개소 관리 ───────── */

export function BrokersDialog({ onClose }: { onClose: () => void }) {
  const { data, openDialog } = useRent()
  const list = [...data.brokers].sort((a, b) => a.name.localeCompare(b.name, "ko"))
  return (
    <FormShell
      title="중개소 관리"
      description="계약할 때 목록에서 고를 중개소를 등록합니다. 계약에 쓰인 중개소는 삭제할 수 없습니다."
      onClose={onClose}
      pending={false}
      error={null}
      submitLabel="중개소 추가"
      onSubmit={() => openDialog({ kind: "broker" })}
    >
      {list.length ? (
        <ul className="divide-y rounded-lg border sm:col-span-2">
          {list.map((b) => {
            const s = brokerStats(data, b.id)
            return (
              <li key={b.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="num truncate text-xs text-muted-foreground">
                    {b.phone || "연락처 없음"} · 계약 {s.count}건{s.fees ? ` · 수수료 ${won(s.fees)}` : ""}
                  </p>
                </div>
                {b.phone && (
                  <a href={`tel:${b.phone}`} aria-label={`${b.name}에 전화`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                    <Phone />
                  </a>
                )}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`${b.name} 수정`} onClick={() => openDialog({ kind: "broker", id: b.id })}>
                  <Pencil />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`${b.name} 삭제`} disabled={s.count > 0}
                  title={s.count > 0 ? "계약에 쓰인 중개소는 삭제할 수 없습니다" : undefined}
                  onClick={() => openDialog({ kind: "deleteBroker", id: b.id })}>
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">아직 등록된 중개소가 없습니다. 계약 등록 창에서 바로 추가할 수도 있습니다.</p>
      )}
    </FormShell>
  )
}

export function BrokerDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data } = useRent()
  const editing = id ? data.brokers.find((b) => b.id === id) : undefined
  const [name, setName] = useState(editing?.name ?? "")
  const [phone, setPhone] = useState(editing?.phone ?? "")
  const [address, setAddress] = useState(editing?.address ?? "")
  const [memo, setMemo] = useState(editing?.memo ?? "")
  const { pending, error, run } = useSubmit(onClose)
  return (
    <FormShell
      title={editing ? "중개소 수정" : "중개소 추가"}
      description="저장하면 시트 「중개소」 탭에 반영됩니다."
      onClose={onClose}
      pending={pending}
      error={error}
      submitLabel="저장"
      onSubmit={() => run(() => saveBrokerAction({ id: editing?.id, name, phone, address, memo }))}
    >
      <Field label="중개소 이름" htmlFor="bk-n">
        <Input id="bk-n" className="h-10" autoComplete="off" placeholder="예: 한빛공인중개사" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="연락처" htmlFor="bk-p">
        <Input id="bk-p" type="tel" className="h-10" placeholder="033-000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="주소 (선택)" htmlFor="bk-a" full>
        <Input id="bk-a" className="h-10" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="메모 (선택)" htmlFor="bk-m" full>
        <Input id="bk-m" className="h-10" placeholder="예: 담당 소장 이름" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </FormShell>
  )
}

export function DeleteBrokerDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRent()
  const b = data.brokers.find((x) => x.id === id)
  if (!b) return null
  return (
    <ConfirmDelete title="중개소 삭제" description={b.name} note="시트 「중개소」 탭에서 이 행이 삭제됩니다."
      action={() => deleteBrokerAction(id)} onClose={onClose} />
  )
}
