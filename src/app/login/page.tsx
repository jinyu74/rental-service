import { Suspense } from "react"
import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "로그인 · 임대장부" }

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="mb-2 grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">임</span>
          <CardTitle className="text-xl font-bold">임대장부</CardTitle>
          <CardDescription>임차인 정보가 있으므로 비밀번호를 입력해야 열립니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
