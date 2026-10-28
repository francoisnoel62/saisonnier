import Link from "next/link"

import { Brand } from "@/components/public/brand"

// Mise en page centrée des pages d'authentification (inspirée du bloc shadcn login-03).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <Brand />
        </Link>
        {children}
      </div>
    </div>
  )
}
