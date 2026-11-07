"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SESSION_COOKIE, SESSION_DAYS, checkPassword, createSessionToken } from "@/lib/auth"

export async function login(_: { error: string } | null, form: FormData) {
  const password = String(form.get("password") ?? "")
  const next = String(form.get("next") ?? "/")
  if (!process.env.AUTH_PASSWORD) return { error: "서버에 AUTH_PASSWORD 환경변수가 설정되지 않았습니다." }
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 800))
    return { error: "비밀번호가 맞지 않습니다." }
  }
  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  })
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/")
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
