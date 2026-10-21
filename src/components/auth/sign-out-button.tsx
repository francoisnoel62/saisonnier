"use client"

import { Loader2Icon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut()
          router.replace("/connexion")
          router.refresh()
        })
      }
    >
      {pending ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <LogOutIcon aria-hidden />
      )}
      Se déconnecter
    </Button>
  )
}
