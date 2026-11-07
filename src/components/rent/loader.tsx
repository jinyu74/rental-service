import { connection } from "next/server"
import { getData } from "@/lib/data"
import { requireSession } from "@/lib/session"
import { RentApp, type View } from "./rent-app"
import { Skeleton } from "@/components/ui/skeleton"

/** 요청마다 시트에서 새로 읽어 클라이언트 앱에 넘깁니다. */
export async function Loader({ view }: { view: View }) {
  await connection()
  const result = await requireSession()
    .then(getData)
    .then((data) => ({ data, error: null }), (e: unknown) => ({ data: null, error: e instanceof Error ? e.message : String(e) }))
  if (result.data) return <RentApp view={view} data={result.data} />
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="font-semibold">데이터를 불러오지 못했습니다.</p>
      <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="불러오는 중">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
