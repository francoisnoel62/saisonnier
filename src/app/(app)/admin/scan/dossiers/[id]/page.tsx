import Link from "next/link"
import { notFound } from "next/navigation"

import { ReviewDecisions } from "@/components/admin/scan/review-decisions"
import { OfferForm } from "@/components/offers/offer-form/offer-form"
import { valueOf } from "@/domain/scan/field"
import {
  proposalFormIssues,
  proposalToAdminFormValues,
} from "@/domain/scan/proposal-form"
import { publicationReadiness } from "@/domain/scan/readiness"
import {
  uniqueIssues,
  scanIssue,
  scanCandidateStatusLabels,
  scanModeLabels,
  scanRunStatusLabels,
} from "@/domain/scan/vocabulary"
import { todayInParis } from "@/domain/offer-activity"
import { formatIsoDate } from "@/domain/offer-display"
import { formatDateTime } from "@/lib/format"
import { listCompanyOptions } from "@/server/companies/companies"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"
import { getCandidateForReview, nextReviewPath } from "@/server/scan/review"
import { validateScanCandidate } from "@/server/scan/review-actions"
import type { ScanSourceDraftSnapshot } from "@/domain/scan/source"
import { loadScanSource } from "@/server/scan/sources/registry"

function safeHref(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "")
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
const fieldLabels: Record<string, string> = {
  title: "Intitulé",
  company: "Entreprise",
  description: "Description",
  missions: "Missions",
  locations: "Lieux",
  locationCandidates: "Lieux à vérifier",
  contract: "Contrat",
  salary: "Salaire",
  workTime: "Temps de travail",
  activity: "Activité",
  validThrough: "Échéance",
  organization: "Organisation",
  profile: "Profil",
  additionalInfo: "Divers",
}
const evidenceLabels = {
  jsonld: "JSON-LD",
  rss: "Flux RSS",
  html_label: "Libellé",
  text: "Texte",
  api: "Donnée structurée",
  listing: "Liste",
}
export default async function ScanCandidatePage({
  params,
}: PageProps<"/admin/scan/dossiers/[id]">) {
  const { id } = await params
  const review = await getCandidateForReview(id)
  if (!review) notFound()
  const { candidate } = review
  const proposal = candidate.proposal
  const [source, referentials, companies, next] = await Promise.all([
    loadScanSource(candidate.sourceKey),
    getOfferFormReferentials(proposal?.occupationId),
    listCompanyOptions(),
    nextReviewPath(id),
  ])
  const sourceLabel = source?.row.label ?? "Source du scan"
  const now = new Date()
  const readiness = proposal
    ? publicationReadiness(proposal, {
        officialHosts:
          source?.row.kind === "employer"
            ? ((source.revision.definition as ScanSourceDraftSnapshot)
                .officialHosts ?? [])
            : [],
        blockedDomains: referentials.blockedDomains,
        today: todayInParis(now),
        now: now.toISOString(),
        potentialDuplicate: review.duplicates.length > 0,
        sourceWithdrawn: source?.row.status === "rejected",
      })
    : { blocking: [], alerts: [] }
  const issues = uniqueIssues([
    ...readiness.blocking,
    ...readiness.alerts,
    ...candidate.issues
      .filter((issue) => issue.code !== "duplicate")
      .map((issue) => scanIssue(issue.code, issue.field)),
    ...(proposal ? proposalFormIssues(proposal) : []),
  ])
  const discovery = safeHref(candidate.discoveryUrl),
    official = safeHref(
      candidate.officialUrl ??
        (proposal ? valueOf(proposal.officialUrl) : undefined),
    )
  const fields = [
    ...new Set(candidate.observations.map((observation) => observation.field)),
  ]
  return (
    <article className="grid min-w-0 gap-6">
      <Link className="text-sm underline" href="/admin/scan/dossiers">
        ← Retour à la file
      </Link>
      <header className="grid gap-2">
        <h2 className="text-xl font-semibold">
          {candidate.title ?? "Dossier du scan"}
        </h2>
        <p>
          {sourceLabel} · {scanCandidateStatusLabels[candidate.status]}
        </p>
        {proposal && (
          <p>
            Entreprise proposée :{" "}
            {valueOf(proposal.company)?.name ?? "À identifier"}
          </p>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          {discovery && (
            <a
              className="underline"
              href={discovery}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Lien de découverte
            </a>
          )}
          {official && (
            <a
              className="underline"
              href={official}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Source officielle
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {candidate.sourcePublishedDate
            ? `Publiée par la source le ${formatIsoDate(candidate.sourcePublishedDate)}`
            : "Date de publication inconnue"}
          <br />
          Découverte le {formatDateTime(candidate.firstSeenAt)}
          {candidate.lastFetchedAt && (
            <>
              <br />
              Fiche consultée le {formatDateTime(candidate.lastFetchedAt)}
            </>
          )}
        </p>
        {review.run && (
          <p className="text-sm">
            {scanModeLabels[review.run.mode]} ·{" "}
            {scanRunStatusLabels[review.run.status]}
          </p>
        )}
      </header>
      {candidate.status === "to_review" && (
        <>
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">À vérifier avant publication</h2>
            {issues.some((issue) => issue.blocking) ? (
              <ul className="mt-2 list-inside list-disc">
                {issues
                  .filter((issue) => issue.blocking)
                  .map((issue, index) => (
                    <li key={index}>{issue.label}</li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">
                Le dossier contient le minimum proposé. Vérifiez la source et
                les valeurs avant publication.
              </p>
            )}
          </section>
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Alertes</h2>
            <ul className="mt-2 list-inside list-disc">
              {issues
                .filter((issue) => !issue.blocking)
                .map((issue, index) => (
                  <li key={index}>{issue.label}</li>
                ))}
            </ul>
            {candidate.occupationReviewId && (
              <Link
                href="/admin/scan/suggestions"
                className="text-sm underline"
              >
                Voir la suggestion de métier
              </Link>
            )}
          </section>
          <ReviewDecisions
            candidateId={id}
            version={candidate.version}
            next={next}
            duplicates={review.duplicates}
          />
          {proposal ? (
            <OfferForm
              key={id}
              space="admin"
              mode="review"
              action={validateScanCandidate.bind(null, id, candidate.version)}
              defaultValues={proposalToAdminFormValues(proposal, {
                companyId: review.companyId,
                sourceName: sourceLabel,
              })}
              companies={companies}
              referentials={referentials}
              originLocked
              companyLocked={false}
            />
          ) : (
            <p>Ce dossier ne contient pas de proposition exploitable.</p>
          )}
        </>
      )}
      {candidate.status === "published" && candidate.offerId && (
        <Link
          className="underline"
          href={`/admin/annonces/${candidate.offerId}/modifier`}
        >
          Voir l’annonce publiée
        </Link>
      )}
      {candidate.status === "rejected" && (
        <p>
          Dossier rejeté
          {candidate.reviewNote ? ` : ${candidate.reviewNote}` : ""}.
        </p>
      )}
      <section className="min-w-0 rounded-lg border p-4">
        <h2 className="font-semibold">Preuves</h2>
        {fields.map((field) => (
          <details key={field} className="border-b py-3">
            <summary className="cursor-pointer font-medium">
              {fieldLabels[field] ?? "Autre observation"}
            </summary>
            <ul className="mt-2 grid gap-3">
              {candidate.observations
                .filter((observation) => observation.field === field)
                .map((observation, index) => (
                  <li key={index} className="min-w-0 text-sm">
                    <p className="text-muted-foreground">
                      {evidenceLabels[observation.evidence.kind]} ·{" "}
                      {observation.evidence.scope === "site"
                        ? "Information générale du site"
                        : "Information du poste"}
                    </p>
                    <blockquote className="mt-1 border-l-2 pl-3 wrap-anywhere whitespace-pre-line">
                      {observation.evidence.excerpt}
                    </blockquote>
                  </li>
                ))}
            </ul>
          </details>
        ))}
        <details className="py-3">
          <summary className="cursor-pointer font-medium">
            Texte utile intégral
          </summary>
          <p className="mt-3 text-sm wrap-anywhere whitespace-pre-line">
            {candidate.pageText ?? "Aucun texte disponible."}
          </p>
        </details>
      </section>
    </article>
  )
}
