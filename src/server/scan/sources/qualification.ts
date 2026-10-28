import "server-only"

import { and, desc, eq, sql } from "drizzle-orm"

import { adapterDescriptor } from "@/domain/scan/adapter-catalog"
import {
  scanSourceDefinitionErrors,
  type ScanSourceDraftSnapshot,
} from "@/domain/scan/source"
import {
  qualificationItems,
  type QualificationItem,
} from "@/domain/scan/source-qualification"
import { db } from "@/lib/db"
import {
  companies,
  scanSourceEvents,
  type ScanSourceEvent,
  type ScanSourceRevision,
  type ScanSourceRow,
} from "@/lib/db/schema"
import { getBlockedDomains } from "@/server/offers/application"

import type { ScanTransaction } from "../claim"
import { isSourceAdapterAvailable, scanUrlPolicy } from "./registry"

type Reader = typeof db | ScanTransaction

export type SampleEventDetails = {
  configHash: string
  status: "running" | "done" | "failed"
  ok?: boolean
  empty?: boolean
}
// Dernier échantillon réussi d'une empreinte (qualification, D4).
export async function lastSuccessfulSample(
  key: string,
  configHash: string,
  tx: Reader = db,
): Promise<(ScanSourceEvent & { details: SampleEventDetails }) | null> {
  const [event] = await tx
    .select()
    .from(scanSourceEvents)
    .where(
      and(
        eq(scanSourceEvents.sourceKey, key),
        eq(scanSourceEvents.kind, "sampled"),
        sql`${scanSourceEvents.details}->>'configHash' = ${configHash}`,
        sql`${scanSourceEvents.details}->>'status' = 'done'`,
        sql`(${scanSourceEvents.details}->>'ok')::boolean`,
      ),
    )
    .orderBy(desc(scanSourceEvents.createdAt))
    .limit(1)
  return (event as ScanSourceEvent & { details: SampleEventDetails }) ?? null
}

// Fiche entreprise de la source : liée, ou retrouvée par le SIREN de l'employeur (SH15).
export async function sourceCompany(row: ScanSourceRow, tx: Reader = db) {
  const [company] = row.companyId
    ? await tx.select().from(companies).where(eq(companies.id, row.companyId))
    : row.employerSiren
      ? await tx
          .select()
          .from(companies)
          .where(eq(companies.siren, row.employerSiren))
      : []
  return company ?? null
}

// Points du §10.3 pour la version courante, lus dans la transaction appelante.
export async function sourceQualification(
  row: ScanSourceRow,
  revision: ScanSourceRevision,
  { tx = db, now = new Date() }: { tx?: Reader; now?: Date } = {},
): Promise<QualificationItem[]> {
  const definition = revision.definition as ScanSourceDraftSnapshot
  const [sample, blockedDomains, company] = await Promise.all([
    lastSuccessfulSample(row.key, revision.configHash, tx),
    getBlockedDomains(tx),
    row.kind === "employer" ? sourceCompany(row, tx) : null,
  ])
  return qualificationItems({
    kind: row.kind,
    definition,
    complete: revision.complete,
    definitionErrors: revision.complete
      ? scanSourceDefinitionErrors(definition, scanUrlPolicy)
      : [],
    adapterAvailable: isSourceAdapterAvailable(row),
    adapterUnavailableReason: row.adapter
      ? adapterDescriptor(row.adapter).unavailableReason
      : undefined,
    reuseDecision: row.reuseDecision,
    scheduledAccessBasis: row.scheduledAccessBasis,
    configHash: revision.configHash,
    lastSample: sample
      ? {
          at: sample.createdAt,
          configHash: sample.details.configHash,
          ok: sample.details.ok === true,
          empty: sample.details.empty === true,
        }
      : null,
    blockedDomains,
    company:
      row.kind === "employer"
        ? { exists: company !== null, nafCode: company?.nafCode ?? null }
        : null,
    now,
  })
}
