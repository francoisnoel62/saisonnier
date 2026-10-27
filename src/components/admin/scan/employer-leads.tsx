"use client"

import { unstable_rethrow, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { EmployerLeadDetails } from "@/domain/scan/employer-lead"
import {
  employerLeadDecisionLabels,
  type EmployerLeadDecision,
} from "@/domain/scan/vocabulary"
import { formatDateTime } from "@/lib/format"
import {
  decideEmployerLeadAction,
  markEmployerWithoutPortalAction,
} from "@/server/scan/sources/actions"

export type EmployerLeadRow = {
  id: string
  status: string
  decision: { decision?: string; note?: string } | null
  occurrences: number
  lastSeenAt: string
  sourceLabel: string | null
  details: EmployerLeadDetails
}
export type EmployerLeadProposal = {
  key: string
  name: string
  siren: string | null
  candidateIds: string[]
}

function LeadCard({ lead }: { lead: EmployerLeadRow }) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()
  const invited = lead.decision?.decision === "invited"
  const wizard = `/admin/scan/sources/nouvelle?${new URLSearchParams({
    employeur: lead.details.name,
    ...(lead.details.siren ? { siren: lead.details.siren } : {}),
    ...(lead.details.candidateIds[0]
      ? { dossier: lead.details.candidateIds[0] }
      : {}),
  })}`
  function decide(decision: EmployerLeadDecision) {
    startTransition(async () => {
      try {
        const result = await decideEmployerLeadAction(lead.id, decision, note)
        if (!result.ok) toast.error(result.message)
        // « A un portail » : l'assistant s'ouvre prérempli.
        else if (decision === "has_portal") router.push(wizard)
        else
          toast.success(`${employerLeadDecisionLabels[decision]} : enregistré.`)
      } catch (error) {
        unstable_rethrow(error)
        toast.error("La décision n’a pas abouti.")
      }
    })
  }
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium wrap-anywhere">{lead.details.name}</h3>
        <Badge variant="secondary">
          {lead.occurrences} dossier{lead.occurrences > 1 ? "s" : ""}
        </Badge>
        {invited && <Badge>Invité</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {[
          lead.details.siren && `SIREN ${lead.details.siren}`,
          lead.details.communeName,
          lead.sourceLabel && `vu sur ${lead.sourceLabel}`,
          `dernière offre le ${formatDateTime(lead.lastSeenAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {lead.details.lastSeenTitle && (
        <p className="text-sm">
          Dernière offre vue : {lead.details.lastSeenTitle}
        </p>
      )}
      {invited ? (
        <p className="text-sm">Invitation : {lead.decision?.note}</p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`lead-note-${lead.id}`}>Note</FieldLabel>
            <Textarea
              id={`lead-note-${lead.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`lead-note-${lead.id}-hint`}
            />
            <FieldDescription id={`lead-note-${lead.id}-hint`}>
              Date et canal du contact, ou motif de l’écart. L’invitation se
              fait à la main, depuis votre boîte : aucun email n’est envoyé.
            </FieldDescription>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="w-full sm:w-fit"
              disabled={pending}
              onClick={() => decide("invited")}
            >
              Invité à déposer ses annonces
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              disabled={pending}
              onClick={() => decide("has_portal")}
            >
              A un portail
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              disabled={pending}
              onClick={() => decide("dismissed")}
            >
              Écarter
            </Button>
          </div>
        </>
      )}
    </li>
  )
}

function ProposalCard({ proposal }: { proposal: EmployerLeadProposal }) {
  const [pending, startTransition] = useTransition()
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="wrap-anywhere">
        {proposal.name}
        {proposal.siren && ` (SIREN ${proposal.siren})`} ·{" "}
        {proposal.candidateIds.length} dossiers
      </span>
      <Button
        variant="outline"
        className="w-full sm:w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await markEmployerWithoutPortalAction(
                proposal.candidateIds[0],
              )
              if (result.ok) toast.success("Piste ouverte.")
              else toast.error(result.message)
            } catch (error) {
              unstable_rethrow(error)
              toast.error("L’action n’a pas abouti.")
            }
          })
        }
      >
        Ouvrir la piste
        <span className="sr-only"> — {proposal.name}</span>
      </Button>
    </li>
  )
}

// Employeurs à inviter (lot F, SH31) : pistes triées par nombre de dossiers puis date ; les
// propositions du scan restent à examiner, rien n'est créé sans l'admin.
export function EmployerLeads({
  leads,
  proposals,
}: {
  leads: EmployerLeadRow[]
  proposals: EmployerLeadProposal[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {leads.length} employeur{leads.length > 1 ? "s" : ""} à inviter ou
        invité{leads.length > 1 ? "s" : ""}.
      </p>
      {leads.length ? (
        <ul className="flex flex-col gap-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">
          Aucun employeur à inviter. Depuis un dossier de découverte : « Cet
          employeur n’a pas de portail carrière ».
        </p>
      )}
      {proposals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">À examiner</h2>
          <p className="text-sm text-muted-foreground">
            Employeurs vus dans au moins deux dossiers de découverte, sans
            source ni piste.
          </p>
          <ul className="flex flex-col gap-2">
            {proposals.map((proposal) => (
              <ProposalCard key={proposal.key} proposal={proposal} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
