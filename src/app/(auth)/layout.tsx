import { SunSnowIcon } from "lucide-react"
import Link from "next/link"

import { site } from "@/config/site"

// Mise en page centrée des pages d'authentification (inspirée du bloc shadcn login-03).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SunSnowIcon className="size-4" aria-hidden />
          </span>
          {site.name}
        </Link>
        {children}
      </div>
    </div>
  )
}
