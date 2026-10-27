"use client"

import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Button } from "@/components/ui/button"
import { resumeScanSourceAction } from "@/server/scan/sources/actions"

// Source suspendue par le disjoncteur (D9) : la reprise exige un test réussi depuis la
// suspension ; aucun contournement d'un refus d'accès.
export function ResumeSource({
  sourceKey,
  version,
  reason,
}: {
  sourceKey: string
  version: number
  reason: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
      <p className="font-medium">Source suspendue</p>
      {reason && <p className="wrap-anywhere">{reason}</p>}
      <p className="text-muted-foreground">
        Testez l’accès ou extrayez un échantillon, puis reprenez la source.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        variant="outline"
        className="w-full sm:w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              const result = await resumeScanSourceAction(sourceKey, version)
              if (result.ok) toast.success("Source reprise.")
              else setError(result.message)
            } catch (error) {
              unstable_rethrow(error)
              setError("La reprise n’a pas abouti.")
            }
          })
        }
      >
        Reprendre la source
      </Button>
    </div>
  )
}
