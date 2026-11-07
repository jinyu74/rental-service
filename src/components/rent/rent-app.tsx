"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { compute, roomName, type Computed } from "@/lib/billing"
import type { AppData } from "@/lib/types"
import { useIsCompact, useIsMobile } from "@/hooks/use-media"
import { useShell } from "./shell"
import { DashboardView } from "./dashboard-view"
import { UnitsView } from "./units-view"
import { PaymentsView } from "./payments-view"
import { RoomDetail } from "./room-detail"
import { ContractDialog, DeletePaymentDialog, EndContractDialog, PayDialog } from "./dialogs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export type View = "dashboard" | "units" | "payments"

export type DialogState =
  | { kind: "pay"; contractId?: string }
  | { kind: "contract"; id?: string; roomId?: string }
  | { kind: "end"; id: string }
  | { kind: "delete"; id: string }
  | null

interface RentCtx {
  data: AppData
  M: Computed
  month: string
  setMonth: (m: string) => void
  isMobile: boolean
  isCompact: boolean
  selected: string | null
  setSelected: (id: string | null) => void
  openRoom: (id: string) => void
  openDialog: (d: Exclude<DialogState, null>) => void
}

const Ctx = createContext<RentCtx | null>(null)

export function useRent() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useRent must be used inside <RentApp>")
  return v
}

export function RentApp({ view, data }: { view: View; data: AppData }) {
  const shell = useShell()
  const router = useRouter()
  const params = useSearchParams()
  const isMobile = useIsMobile()
  const isCompact = useIsCompact()
  const month = shell.month ?? data.today.slice(0, 7)
  const M = useMemo(() => compute(data, month), [data, month])

  const [selected, setSelectedState] = useState<string | null>(() => params.get("room"))
  const [sheetRoom, setSheetRoom] = useState<string | null>(null)
  const [returnRoom, setReturnRoom] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const { setSync } = shell
  useEffect(() => {
    setSync({ syncedAt: data.syncedAt, source: data.source })
  }, [data.syncedAt, data.source, setSync])

  const setSelected = (id: string | null) => {
    setSelectedState(id)
    if (view === "units") window.history.replaceState(null, "", id ? `/units?room=${encodeURIComponent(id)}` : "/units")
  }

  const openRoom = (id: string) => {
    if (isCompact) return setSheetRoom(id)
    if (view === "units") return setSelected(id)
    router.push(`/units?room=${encodeURIComponent(id)}`)
  }

  const openDialog = (d: Exclude<DialogState, null>) => {
    // 모바일 호실 상세에서 연 경우: 상세를 잠시 닫고 저장/취소 후 다시 연다
    if (sheetRoom) {
      setReturnRoom(sheetRoom)
      setSheetRoom(null)
    }
    setDialog(d)
  }

  const closeDialog = () => {
    setDialog(null)
    if (returnRoom) {
      setSheetRoom(returnRoom)
      setReturnRoom(null)
    }
  }

  // 화면이 넓어지면 시트 대신 옆 패널을 쓰므로 시트는 좁은 화면에서만 표시
  const sheetView = isCompact && sheetRoom ? M.rooms.find((r) => r.id === sheetRoom) : null

  const ctx: RentCtx = {
    data,
    M,
    month,
    setMonth: shell.setMonth,
    isMobile,
    isCompact,
    selected,
    setSelected,
    openRoom,
    openDialog,
  }

  let body: ReactNode
  if (view === "units") body = <UnitsView />
  else if (view === "payments") body = <PaymentsView />
  else body = <DashboardView />

  return (
    <Ctx.Provider value={ctx}>
      {body}

      <Sheet open={!!sheetView} onOpenChange={(o) => !o && setSheetRoom(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-2xl gap-0 overflow-hidden rounded-t-2xl p-0 data-[side=bottom]:h-[94dvh]">
          {sheetView && (
            <>
              <SheetHeader className="border-b px-5 py-3">
                <SheetTitle>{roomName(sheetView)}</SheetTitle>
                <SheetDescription>{sheetView.current?.tenant ?? "공실"}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                <RoomDetail room={sheetView} hideTitle />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {dialog?.kind === "pay" && <PayDialog contractId={dialog.contractId} onClose={closeDialog} />}
      {dialog?.kind === "contract" && <ContractDialog id={dialog.id} roomId={dialog.roomId} onClose={closeDialog} />}
      {dialog?.kind === "end" && <EndContractDialog id={dialog.id} onClose={closeDialog} />}
      {dialog?.kind === "delete" && <DeletePaymentDialog id={dialog.id} onClose={closeDialog} />}
    </Ctx.Provider>
  )
}
