import { Suspense } from "react"
import type { Metadata } from "next"
import { Loader, PageSkeleton } from "@/components/rent/loader"

export const metadata: Metadata = { title: "수납 내역 · 임대장부" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Loader view="payments" />
    </Suspense>
  )
}
