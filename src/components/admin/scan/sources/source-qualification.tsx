"use client"

import { CheckIcon, CircleAlertIcon, XIcon } from "lucide-react"
import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  canMarkReady,
  robotsIsNotPermission,
  type QualificationItem,
} from "@/domain/scan/source-qualification"
import {
  scanReuseDecisionLabels,
  scanReuseDecisions,
  type ScanReuseDecision,
  type ScanSourceKind,
  type ScanSourceStatus,
} from "@/domain/scan/vocabulary"
import { formatDateTime } from "@/lib/format"
import {
  decideScanSourceReuseAction,
  transitionScanSourceAction,
} from "@/server/scan/sources/actions"

const stateIcon = {
  ok: <CheckIcon className="size-4 text-emerald-600" aria-hidden />,
  missing: <XIcon className="size-4 text-destructive" aria-hidden />,
  alert: <CircleAlertIcon className="size-4 text-amber-600" aria-hidden />,
}
const stateLabel = { ok: "Fait", missing: "Manquant", alert: "Alerte" }

export type ReuseState = {
  decision: ScanReuseDecision
  note: string | null
  decidedAt: string | null
  decidedBy: string | null
  scheduledAccessBasis: string | null
}

// Onglet « Qualification » (§10.3) : les points, la décision de reprise et « Marquer prête ».
export function SourceQualification({
  source,
  items,
  reuse,
}: {
  source: {
    key: string
    kind: ScanSourceKind
    status: ScanSourceStatus
    version: number
  }
  items: QualificationItem[]
  reuse: ReuseState
}) {
  const [decision, setDecision] = useState<ScanReuseDecision>(reuse.decision)
  const [note, setNote] = useState(reuse.note ?? "")
  const [basis, setBasis] = useState(reuse.scheduledAccessBasis ?? "")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ready = canMarkReady(items)

  function decide(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await decideScanSourceReuseAction(
          source.key,
          source.version,
          { decision, note, scheduledAccessBasis: basis },
        )
        if (result.ok) {
          toast.success("Décision de reprise enregistrée.")
        } else {
          setErrors(("fieldErrors" in result && result.fieldErrors) || {})
          setFormError(result.message)
        }
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "L’enregistrement n’a pas abouti. Votre saisie est conservée.",
        )
      }
    })
  }
  function markReady() {
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await transitionScanSourceAction(
          source.key,
          source.version,
          "mark_ready",
        )
        if (result.ok) {
          toast.success("Source prête : elle peut être activée.")
        } else setFormError(result.message)
      } catch (error) {
        unstable_rethrow(error)
        setFormError("L’action n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.code} className="flex items-start gap-2">
            <span className="mt-0.5">{stateIcon[item.state]}</span>
            <div className="flex min-w-0 flex-col">
              <span>
                <span className="sr-only">{stateLabel[item.state]} : </span>
                {item.label}
                {!item.blocking && item.state !== "ok" && " (non bloquant)"}
              </span>
              {item.detail && (
                <span className="text-sm wrap-anywhere text-muted-foreground">
                  {item.detail}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {source.status === "draft" && (
        <div className="flex flex-col gap-2">
          <Button
            className="w-full sm:w-fit"
            disabled={pending || !ready}
            aria-describedby={!ready ? "mark-ready-reason" : undefined}
            onClick={markReady}
          >
            Marquer comme prête
          </Button>
          {!ready && (
            <p id="mark-ready-reason" className="text-sm text-muted-foreground">
              Tous les points bloquants doivent être faits.
            </p>
          )}
        </div>
      )}

      <form
        className="flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={decide}
      >
        <h3 className="font-semibold">Décision de reprise</h3>
        <p className="text-sm">
          {reuse.decidedAt
            ? `${scanReuseDecisionLabels[reuse.decision]} le ${formatDateTime(reuse.decidedAt)} par ${reuse.decidedBy ?? "le système"}.`
            : "Aucune décision n’a été prise."}
        </p>
        <p className="text-sm text-muted-foreground">{robotsIsNotPermission}</p>
        <FieldSet>
          <FieldLegend variant="label">Décision</FieldLegend>
          <RadioGroup
            value={decision}
            onValueChange={(value) => setDecision(value as ScanReuseDecision)}
          >
            {scanReuseDecisions.map((value) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem value={value} id={`reuse-${value}`} />
                <Label htmlFor={`reuse-${value}`}>
                  {scanReuseDecisionLabels[value]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor="reuse-note">Note</FieldLabel>
          <Textarea
            id="reuse-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={!!errors.note}
            aria-describedby="reuse-note-hint reuse-note-error"
          />
          <FieldDescription id="reuse-note-hint">
            Obligatoire : réponse reçue, date du courrier, ou raison de
            l’acceptation.
          </FieldDescription>
          <FieldError
            id="reuse-note-error"
            errors={errors.note?.map((message) => ({ message }))}
          />
        </Field>
        {source.kind === "discovery" && (
          <Field data-invalid={!!errors.scheduledAccessBasis}>
            <FieldLabel htmlFor="reuse-basis">
              Justification des passages quotidiens
            </FieldLabel>
            <Textarea
              id="reuse-basis"
              value={basis}
              onChange={(event) => setBasis(event.target.value)}
              aria-describedby="reuse-basis-hint"
            />
            <FieldDescription id="reuse-basis-hint">
              API officielle avec compte partenaire, ou avis juridique écrit.
              Sans elle, la découverte ne sert qu’au remplissage initial.
            </FieldDescription>
            <FieldError
              errors={errors.scheduledAccessBasis?.map((message) => ({
                message,
              }))}
            />
          </Field>
        )}
        {formError && <FormAlert>{formError}</FormAlert>}
        <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
          Enregistrer la décision
        </Button>
      </form>
    </div>
  )
}
