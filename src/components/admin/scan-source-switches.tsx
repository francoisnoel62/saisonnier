"use client"

import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import type { ScanSourceSummary } from "@/domain/scan/source"
import {
  scanSourceSwitches,
  scanSourceSwitchLabels,
  type ScanSourceSwitch,
} from "@/domain/scan/vocabulary"
import { setScanSourceSwitchAction } from "@/server/scan/actions"

export type ScanSourceState = Pick<
  ScanSourceSummary,
  | "key"
  | "version"
  | "enabled"
  | "dailyEnabled"
  | "autoPublish"
  | "switchBlockers"
>

// D11 : trois interrupteurs indépendants ; un interrupteur bloqué dit pourquoi.
export function ScanSourceSwitches({ source }: { source: ScanSourceState }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState({
    version: source.version,
    enabled: source.enabled,
    dailyEnabled: source.dailyEnabled,
    autoPublish: source.autoPublish,
  })
  function toggle(flag: ScanSourceSwitch, value: boolean) {
    if (pending) return
    const previous = state
    setState({ ...state, [flag]: value })
    startTransition(async () => {
      try {
        const result = await setScanSourceSwitchAction(
          source.key,
          previous.version,
          flag,
          value,
        )
        if (result.ok)
          setState((current) => ({ ...current, version: result.version }))
        else {
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
      {scanSourceSwitches.map((flag) => {
        const id = `scan-${flag}-${source.key}`
        const blocker = state[flag] ? null : source.switchBlockers[flag]
        return (
          <Field key={flag} orientation="horizontal">
            <Switch
              id={id}
              checked={state[flag]}
              disabled={pending || blocker !== null}
              aria-describedby={blocker ? `${id}-reason` : undefined}
              onCheckedChange={(value) => toggle(flag, value)}
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor={id}>
                {scanSourceSwitchLabels[flag]}
              </FieldLabel>
              {blocker && (
                <FieldDescription id={`${id}-reason`}>
                  {blocker}
                </FieldDescription>
              )}
            </div>
          </Field>
        )
      })}
      <FieldDescription>
        Le remplissage initial ne publie jamais automatiquement. Les passages
        quotidiens restent soumis aux contrôles de publication.
      </FieldDescription>
    </div>
  )
}
