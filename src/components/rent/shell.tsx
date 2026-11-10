"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, useState, useTransition, type ReactNode } from "react"
import { Building2, LayoutDashboard, LogOut, ReceiptText, RefreshCw, Wallet } from "lucide-react"
import { toast } from "sonner"
import { reloadAction } from "@/app/actions"
import { logout } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "대시보드", short: "홈", icon: LayoutDashboard },
  { href: "/units", label: "호실·계약", short: "호실", icon: Building2 },
  { href: "/payments", label: "수납 내역", short: "수납", icon: ReceiptText },
  { href: "/expenses", label: "지출", short: "지출", icon: Wallet },
] as const

interface SyncInfo {
  syncedAt: string
  source: "sheets" | "mock"
}

interface ShellCtx {
  month: string | null
  setMonth: (m: string) => void
  sync: SyncInfo | null
  setSync: (s: SyncInfo) => void
}

const Ctx = createContext<ShellCtx | null>(null)

export function useShell() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useShell must be used inside <Shell>")
  return v
}

export function Shell({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncInfo | null>(null)
  const [pending, start] = useTransition()
  const path = usePathname()
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href))

  const reload = () =>
    start(async () => {
      const r = await reloadAction()
      if (r.ok) toast.success(r.message)
      else toast.error(r.error)
    })

  return (
    <Ctx.Provider value={{ month, setMonth, sync, setSync }}>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">임</span>
            임대장부
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="주 메뉴">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active(n.href) && "bg-accent text-accent-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {sync?.source === "mock" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">미리보기 데이터</span>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {pending ? "불러오는 중…" : sync ? `시트 동기화 ${sync.syncedAt}` : ""}
            </span>
            <Button variant="ghost" size="icon" onClick={reload} disabled={pending} aria-label="시트 새로고침">
              <RefreshCw className={cn(pending && "animate-spin")} />
            </Button>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="icon" aria-label="로그아웃">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 md:px-6 md:pt-8 md:pb-16">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="하단 메뉴"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
              active(n.href) && "text-primary",
            )}
          >
            <n.icon className="size-5" />
            {n.short}
          </Link>
        ))}
      </nav>
    </Ctx.Provider>
  )
}
