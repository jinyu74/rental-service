"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "./actions"

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  const next = useSearchParams().get("next") ?? "/"
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-1.5">
        <Label htmlFor="pw">비밀번호</Label>
        <Input id="pw" name="password" type="password" autoComplete="current-password" required autoFocus className="h-11" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "확인 중…" : "들어가기"}
      </Button>
    </form>
  )
}
