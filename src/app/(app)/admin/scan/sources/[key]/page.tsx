import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SourceHeader } from "@/components/admin/scan/sources/source-header"
import { SourceHistory } from "@/components/admin/scan/sources/source-history"
import { SourceQualification } from "@/components/admin/scan/sources/source-qualification"
import { QualificationTools } from "@/components/admin/scan/sources/source-qualification-tools"
import {
  SourceConfiguration,
  SourceTests,
  type SourceTestRow,
} from "@/components/admin/scan/sources/source-sections"
import { site } from "@/config/site"
import { isBlockedHost } from "@/domain/blocked-domains"
import { authorizationRequestText } from "@/domain/scan/authorization-request"
import { env } from "@/lib/env"
import { cn } from "@/lib/utils"
import { getBlockedDomains } from "@/server/offers/application"
import { getScanSourceDetail } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Source du scan" }
// Sonde et échantillon depuis l'en-tête.
export const maxDuration = 120

const tabs = [
  { id: "configuration", label: "Configuration" },
  { id: "qualification", label: "Qualification" },
  { id: "tests", label: "Tests" },
  { id: "historique", label: "Historique" },
] as const
type Tab = (typeof tabs)[number]["id"]

export default async function ScanSourcePage({
  params,
  searchParams,
}: PageProps<"/admin/scan/sources/[key]">) {
  const { key } = await params
  const { onglet } = await searchParams
  const detail = await getScanSourceDetail(key)
  if (!detail) notFound()
  const tab: Tab =
    tabs.find((item) => item.id === onglet)?.id ?? "configuration"
  const author = (id: string | null) =>
    id ? (detail.actorNames[id] ?? "Compte supprimé") : "Système"
  const { row, summary, definition } = detail
  const blockedDomains =
    tab === "qualification" && row.kind === "discovery"
      ? await getBlockedDomains()
      : []
  const adapterParams = (definition.adapterParams ?? {}) as Record<
    string,
    unknown
  >
  return (
    <article className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link className="underline" href="/admin/scan/sources">
          ← Sources
        </Link>
      </nav>
      <SourceHeader
        source={summary}
        pendingCandidates={detail.pendingCandidates}
        rejectionReason={row.rejectionReason}
      />
      <nav aria-label="Onglets de la source" className="border-b">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {tabs.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/scan/sources/${key}?onglet=${item.id}`}
                aria-current={item.id === tab ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 py-2",
                  item.id === tab
                    ? "border-primary font-medium"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label={tabs.find((item) => item.id === tab)!.label}>
        {tab === "configuration" && (
          <SourceConfiguration
            definition={detail.definition}
            company={detail.company}
          />
        )}
        {tab === "qualification" && row.status !== "archived" && (
          <div className="mb-6">
            <QualificationTools
              sourceKey={key}
              uncoveredHosts={
                row.kind === "discovery"
                  ? (definition.officialHosts ?? []).filter(
                      (host) => !isBlockedHost(host, blockedDomains),
                    )
                  : []
              }
              canCreateCompany={
                row.kind === "employer" &&
                !!row.employerSiren &&
                detail.company === null
              }
              authorizationText={
                row.kind === "employer" && row.reuseDecision === "pending"
                  ? authorizationRequestText(
                      {
                        label: row.label,
                        employerName: row.employerName,
                        portalUrl:
                          typeof adapterParams.portalUrl === "string"
                            ? adapterParams.portalUrl
                            : (definition.listUrls?.[0] ?? null),
                      },
                      { name: site.name, url: env.BETTER_AUTH_URL },
                    )
                  : null
              }
            />
          </div>
        )}
        {tab === "qualification" && (
          <SourceQualification
            source={{
              key: row.key,
              kind: row.kind,
              status: row.status,
              version: row.version,
            }}
            items={detail.qualification}
            reuse={{
              decision: row.reuseDecision,
              note: row.reuseDecisionNote,
              decidedAt: row.reuseDecidedAt?.toISOString() ?? null,
              decidedBy: row.reuseDecidedAt
                ? author(row.reuseDecidedByUserId)
                : null,
              scheduledAccessBasis: row.scheduledAccessBasis,
            }}
          />
        )}
        {tab === "tests" && (
          <SourceTests
            configHash={detail.revision.configHash}
            tests={detail.events
              .filter(
                (event) =>
                  event.kind === "probed" ||
                  event.kind === "sampled" ||
                  event.kind === "detected",
              )
              .map(
                (event) =>
                  ({
                    id: event.id,
                    kind: event.kind,
                    createdAt: event.createdAt.toISOString(),
                    author: author(event.actorUserId),
                    details: event.details,
                  }) as SourceTestRow,
              )}
          />
        )}
        {tab === "historique" && (
          <SourceHistory
            source={{
              key,
              version: row.version,
              revision: row.revision,
              archived: row.status === "archived",
            }}
            revisions={detail.revisions.map((revision) => ({
              revision: revision.revision,
              definition: revision.definition,
              complete: revision.complete,
              note: revision.note,
              createdAt: revision.createdAt.toISOString(),
              author: author(revision.createdByUserId),
            }))}
            events={detail.events.map((event) => ({
              id: event.id,
              kind: event.kind,
              revision: event.revision,
              details: event.details,
              createdAt: event.createdAt.toISOString(),
              author: author(event.actorUserId),
            }))}
          />
        )}
      </section>
    </article>
  )
}
