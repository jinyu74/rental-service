import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans_KR } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const plex = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false,
})

export const metadata: Metadata = {
  title: "임대장부",
  description: "춘천·시흥 건물 임대 계약과 월별 수납 관리",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "임대장부", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
