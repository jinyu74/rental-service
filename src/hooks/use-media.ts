"use client"

import { useSyncExternalStore } from "react"

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** 768px 미만: 휴대폰 배치 (입력 창을 아래에서 올라오는 시트로) */
export const useIsMobile = () => useMedia("(max-width: 767px)")

/** 1024px 미만: 호실 상세 패널이 옆에 없으므로 시트로 연다 */
export const useIsCompact = () => useMedia("(max-width: 1023px)")
