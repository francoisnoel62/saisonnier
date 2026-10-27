import "server-only"

import { formatSalary } from "@/domain/salary"
import { todayInParis } from "@/domain/offer-activity"
import { valueOf } from "@/domain/scan/field"
import { scanFailureLabels, stopsSource } from "@/domain/scan/http"
import { buildProposal } from "@/domain/scan/proposal"
import { publicationReadiness } from "@/domain/scan/readiness"
import {
  sampleCoverage,
  type ExtractionSample,
  type ExtractionSampleItem,
} from "@/domain/scan/sample"
import type { ScanSourceDefinition } from "@/domain/scan/source"
import { db } from "@/lib/db"
import { departments } from "@/lib/db/schema"
import { env } from "@/lib/env"
import { getBlockedDomains } from "@/server/offers/application"

import {
  createAdapterContext,
  type AdapterContext,
  type ListCursor,
} from "./sources/adapter"
import { scanAdapter } from "./sources/adapters"

export async function sampleScanSource(
  source: ScanSourceDefinition,
  suppliedContext?: AdapterContext,
): Promise<ExtractionSample> {
  const adapter = scanAdapter(source.adapter)
  if (!adapter) throw new Error("Cette source n'a pas d'extracteur actif")
  const now = new Date()
  const [codes, blockedDomains] = await Promise.all([
    db.select({ code: departments.code }).from(departments),
    getBlockedDomains(),
  ])
  const ctx =
    suppliedContext ??
    createAdapterContext(source, {
      departmentCodes: codes.map((department) => department.code),
      now,
      deadline: +now + 100_000,
    })
  const items: ExtractionSampleItem[] = []
  let cursor: ListCursor | null = null,
    failure: string | undefined
  const seen = new Set<string>()
  do {
    const page = await adapter.listPage(ctx, cursor)
    if (page.kind !== "listed") {
      failure = scanFailureLabels[page.reason]
      break
    }
    cursor = page.next
    for (const listed of page.postings) {
      if (seen.has(listed.identityKey)) continue
      seen.add(listed.identityKey)
      const read = await adapter.readPosting(ctx, listed)
      if (read.kind !== "extracted") {
        items.push({
          url: listed.url,
          title: listed.title ?? "Fiche illisible",
          readable: false,
          fields: {
            contract: { established: false, text: "Non lu" },
            period: { established: false, text: "Non lu" },
            locations: { established: false, text: "Non lu" },
            application: { established: false, text: "Non lu" },
            salary: { established: false, text: "Non lu" },
          },
          issues: [
            read.kind === "gone"
              ? "Fiche disparue"
              : read.reason === "invalid_document"
                ? "Document illisible"
                : scanFailureLabels[read.reason],
          ],
        })
        if (
          read.kind === "unreadable" &&
          read.reason !== "invalid_document" &&
          stopsSource(read.reason)
        ) {
          cursor = null
          break
        }
      } else {
        const proposal = buildProposal(read.posting, {
          referenceDate: todayInParis(new Date(ctx.now)),
        })
        const readiness = publicationReadiness(proposal, {
          officialHosts: source.kind === "employer" ? source.officialHosts : [],
          blockedDomains,
          today: todayInParis(new Date(ctx.now)),
          now: ctx.now,
        })
        const period = valueOf(proposal.period),
          places = valueOf(proposal.locations),
          application = valueOf(proposal.application),
          salary = valueOf(proposal.salary)
        items.push({
          url: listed.url,
          title: valueOf(proposal.title) ?? listed.title ?? "Sans intitulé",
          companyName: valueOf(proposal.company)?.name ?? null,
          readable: true,
          fields: {
            contract: {
              established: valueOf(proposal.contract) === "seasonal",
              text:
                valueOf(proposal.contract) === "seasonal"
                  ? "Saisonnier explicite"
                  : "À vérifier",
            },
            period: {
              established: !!period,
              text:
                period?.startDate && period.endDate
                  ? `${period.startDate} → ${period.endDate}`
                  : period?.duration
                    ? `${period.duration.value} ${period.duration.unit === "months" ? "mois" : "semaines"}`
                    : "À vérifier",
            },
            locations: {
              established: !!places?.length,
              text:
                places
                  ?.map(
                    (place) => `${place.communeName} (${place.departmentCode})`,
                  )
                  .join(" · ") ?? "À vérifier",
            },
            application: {
              established: !!(
                application?.emails.length ||
                application?.phones.length ||
                application?.formUrl
              ),
              text:
                application?.emails.length || application?.phones.length
                  ? "Contact de recrutement"
                  : application?.formUrl
                    ? "Formulaire officiel"
                    : "À vérifier",
            },
            salary: {
              established: !!salary?.length,
              text:
                salary?.map(formatSalary).join(" · ") ||
                valueOf(proposal.salaryPrecision) ||
                "Non précisé",
            },
          },
          issues: [...readiness.blocking, ...readiness.alerts].map(
            (issue) => issue.label,
          ),
        })
      }
      if (items.length >= 10) break
    }
  } while (cursor && items.length < 10 && Date.now() < ctx.deadline)
  const result: ExtractionSample = {
    sourceKey: source.key,
    deploymentUrl: env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : env.BETTER_AUTH_URL,
    sampledAt: ctx.now,
    extractorVersion: adapter.extractorVersion,
    items,
    coverage: sampleCoverage(items),
    ...(failure ? { failure } : {}),
  }
  console.info("[scan échantillon]", JSON.stringify(result))
  return result
}
