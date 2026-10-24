"use client"

import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import {
  setScanSourceEnabledAction,
  setScanSourceAutoPublishAction,
} from "@/server/scan/actions"

export type ScanSourceState = {
  key: string
  enabled: boolean
  autoPublish: boolean
}

export function ScanSourceSwitches({ source }: { source: ScanSourceState }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState({
    enabled: source.enabled,
    autoPublish: source.autoPublish,
  })
  function toggle(flag: "enabled" | "autoPublish", enabled: boolean) {
    if (pending) return
    const previous = state
    setState({ ...state, [flag]: enabled })
    startTransition(async () => {
      try {
        const action =
          flag === "enabled"
            ? setScanSourceEnabledAction
            : setScanSourceAutoPublishAction
        const result = await action(source.key, enabled)
        if (!result.ok) {
          setState(previous)
          toast.error(result.message)
        }
      } catch (error) {
        unstable_rethrow(error)
        setState(previous)
        toast.error("Le changement n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal">
        <Switch
          id={`scan-enabled-${source.key}`}
          checked={state.enabled}
          disabled={pending}
          onCheckedChange={(enabled) => toggle("enabled", enabled)}
        />
        <FieldLabel htmlFor={`scan-enabled-${source.key}`}>Activée</FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <Switch
          id={`scan-auto-${source.key}`}
          checked={state.autoPublish}
          disabled={pending}
          aria-describedby={`scan-auto-help-${source.key}`}
          onCheckedChange={(enabled) => toggle("autoPublish", enabled)}
        />
        <FieldLabel htmlFor={`scan-auto-${source.key}`}>
          Publication automatique (passages quotidiens)
        </FieldLabel>
      </Field>
      <FieldDescription id={`scan-auto-help-${source.key}`}>
        Le remplissage initial ne publie jamais automatiquement. Les passages
        quotidiens restent soumis aux contrôles de publication.
      </FieldDescription>
    </div>
  )
}
