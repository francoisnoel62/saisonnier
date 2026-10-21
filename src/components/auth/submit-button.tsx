import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean
  children: React.ReactNode
}) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}
