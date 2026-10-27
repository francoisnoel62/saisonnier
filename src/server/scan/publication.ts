import "server-only"

import { and, eq, or, inArray } from "drizzle-orm"

import { isBlockedHost } from "@/domain/blocked-domains"
import { expiryReason, todayInParis } from "@/domain/offer-activity"
import {
  adminOfferInputSchema,
  adminOfferToFormValues,
  areExtraLocationsValid,
  type AdminOfferInput,
} from "@/domain/offer-input"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import { valueOf } from "@/domain/scan/field"
import {
  proposalToOfferInput,
  reviewedPublicationProposal,
} from "@/domain/scan/proposal-offer"
import { canAutoPublish, publicationReadiness } from "@/domain/scan/readiness"
import {
  scanIssue,
  uniqueIssues,
  type ScanIssue,
} from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import {
  companies,
  departments,
  offers,
  scanCandidates,
  scanReviews,
  scanSources,
  type ScanRun,
} from "@/lib/db/schema"
import { getBlockedDomains } from "@/server/offers/application"
import { isUuid } from "@/server/offers/queries"
import { replaceOfferLocations } from "@/server/offers/locations"

import { withRunClaim, type ScanTransaction } from "./claim"
import { scanSourceDefinitions } from "./sources/registry"
import { attachOccupationInTransaction } from "./occupations"

export type PublicationRequest = { candidateId: string; now?: Date } & (
  | { kind: "admin"; userId: string; version: number; input: AdminOfferInput }
  | { kind: "scan"; runId: string; token: string }
)
export type PublicationResult =
  | { ok: true; offerId: string; created: boolean }
  | { ok: false; reason: "conflict" | "blocked"; issues: ScanIssue[] }
  // Validation humaine d'un dossier déjà publié : ses valeurs n'ont pas été enregistrées.
  | { ok: false; reason: "already_published"; offerId: string }
const conflict: PublicationResult = {
  ok: false,
  reason: "conflict",
  issues: [],
}

async function publish(
  tx: ScanTransaction,
  request: PublicationRequest,
  run?: ScanRun,
): Promise<PublicationResult> {
  const [candidate] = await tx
    .select()
    .from(scanCandidates)
    .where(eq(scanCandidates.id, request.candidateId))
    .for("update")
  if (!candidate) return conflict
  // Le rejeu d'une étape du scan constate la publication, même si l'annonce a été retirée depuis.
  // Une seconde validation humaine porte d'autres valeurs : les ignorer en silence ferait croire
  // qu'elles sont publiées.
  if (candidate.status === "published" && candidate.offerId)
    return request.kind === "admin"
      ? { ok: false, reason: "already_published", offerId: candidate.offerId }
      : { ok: true, offerId: candidate.offerId, created: false }
  if (candidate.offerId || !candidate.proposal) return conflict
  if (
    request.kind === "admin"
      ? candidate.status !== "to_review" ||
        candidate.version !== request.version ||
        request.input.origin !== "collected"
      : !run ||
        !["discovered", "failed"].includes(candidate.status) ||
        (candidate.firstRunId !== run.id &&
          candidate.lastSeenAt < run.startedAt)
  )
    return conflict

  const proposal = candidate.proposal
  const proposedCompany = valueOf(proposal.company)
  const [company] =
    request.kind === "admin"
      ? await tx
          .select()
          .from(companies)
          .where(
            eq(
              companies.id,
              isUuid(request.input.companyId)
                ? request.input.companyId
                : "00000000-0000-0000-0000-000000000000",
            ),
          )
      : proposedCompany
        ? await tx
            .select()
            .from(companies)
            .where(
              proposedCompany.siren
                ? eq(companies.siren, proposedCompany.siren)
                : eq(companies.legalName, proposedCompany.name),
            )
            .limit(1)
        : []
  const input =
    request.kind === "admin"
      ? { ...request.input, seasonalContractConfirmed: true }
      : {
          ...proposalToOfferInput(proposal),
          companyId: company?.id ?? "",
          origin: "collected" as const,
          sourceName: scanSourceDefinitions[candidate.sourceKey]?.label ?? null,
          applicationChannel: "employer" as const,
          recruiterName: null,
          hideCompanyIdentity: false,
        }
  const now = request.now ?? new Date()
  const today = todayInParis(now)
  const blockedDomains = await getBlockedDomains(tx)
  const duplicates = await tx
    .select({ id: scanReviews.id })
    .from(scanReviews)
    .where(
      and(
        eq(scanReviews.kind, "duplicate"),
        eq(scanReviews.status, "open"),
        or(
          eq(scanReviews.candidateId, candidate.id),
          eq(scanReviews.otherCandidateId, candidate.id),
        ),
      ),
    )
  const source = scanSourceDefinitions[candidate.sourceKey]
  let officialHosts = source?.kind === "employer" ? source.officialHosts : []
  if (
    source?.kind === "discovery" &&
    request.kind === "admin" &&
    request.input.sourceUrl &&
    URL.canParse(request.input.sourceUrl)
  ) {
    // La revue humaine atteste la nouvelle source employeur. L'hôte de
    // découverte ne peut pas devenir officiel ; les exclusions restent relues.
    const host = new URL(request.input.sourceUrl).hostname
    if (!isBlockedHost(host, source.officialHosts)) officialHosts = [host]
  }
  const readiness = publicationReadiness(
    request.kind === "admin"
      ? reviewedPublicationProposal(
          proposal,
          request.input,
          company?.legalName ?? "",
        )
      : proposal,
    {
      officialHosts,
      blockedDomains,
      today,
      now: now.toISOString(),
      potentialDuplicate: duplicates.length > 0,
    },
  )
  const knownDepartments = await tx
    .select({ code: departments.code })
    .from(departments)
    .where(
      inArray(departments.code, [
        input.departmentCode,
        ...input.extraLocations.map((place) => place.departmentCode),
      ]),
    )
  const department = knownDepartments.find(
    (row) => row.code === input.departmentCode,
  )
  const minimum = checkPublicationMinimum(
    { ...input, companyId: company?.id, departmentCode: department?.code },
    { origin: "collected", blockedDomains },
  )
  const issues = uniqueIssues([
    ...readiness.blocking,
    ...minimum.missing.map((item) =>
      scanIssue(
        item.requirement === "recruiter" ? "application" : item.requirement,
      ),
    ),
    ...(expiryReason(input, today) ? [scanIssue("activity")] : []),
    ...(!candidate.lastFetchedAt ? [scanIssue("detail_unreadable")] : []),
    // Le formulaire de l'admin borne chaque champ ; une publication automatique ne contourne pas
    // ces bornes (une valeur hors colonne ferait échouer la transaction).
    ...(request.kind === "scan" &&
    !adminOfferInputSchema({
      today,
      blockedDomains,
      departmentCodes: knownDepartments.map((row) => row.code),
      occupationIds: [],
    }).safeParse(
      adminOfferToFormValues({
        ...input,
        occupationId: null,
        companyId: company?.id ?? "",
      }),
    ).success
      ? [scanIssue("invalid_values")]
      : []),
    ...(!areExtraLocationsValid(
      input,
      input.extraLocations,
      knownDepartments.map((row) => row.code),
    )
      ? [scanIssue("location")]
      : []),
  ])
  if (issues.length || !company) return { ok: false, reason: "blocked", issues }
  if (request.kind === "scan") {
    const [state] = await tx
      .select()
      .from(scanSources)
      .where(eq(scanSources.key, candidate.sourceKey))
    if (
      !run ||
      !canAutoPublish({
        mode: run.mode,
        sourceAutoPublish: !!state?.enabled && !!state.autoPublish,
        readiness,
      })
    )
      return {
        ok: false,
        reason: "blocked",
        issues: [
          {
            code: "official_source",
            label:
              run?.mode === "bootstrap"
                ? "Le remplissage initial exige une validation humaine"
                : "Publication automatique non autorisée pour cette source",
            blocking: true,
          },
        ],
      }
  }
  // Ne jamais insérer de champ de décision dans les colonnes de l'annonce.
  const attached =
    request.kind === "scan"
      ? await attachOccupationInTransaction(tx, candidate)
      : candidate
  const {
    seasonalContractConfirmed: confirmed,
    extraLocations,
    ...values
  } = input
  void confirmed
  const [offer] = await tx
    .insert(offers)
    .values({
      ...values,
      occupationId:
        request.kind === "scan"
          ? (attached.proposal?.occupationId ?? null)
          : values.occupationId,
      season: input.season,
      companyId: company.id,
      origin: "collected",
      status: "published",
      createdByUserId: null,
      publishedAt: now,
      sourceCheckedAt: candidate.lastFetchedAt,
      sourcePublishedDate: candidate.sourcePublishedDate,
      sourcePublishedAt: candidate.sourcePublishedAt,
      firstDiscoveredAt: candidate.firstSeenAt,
      humanVerifiedAt: request.kind === "admin" ? now : null,
      humanVerifiedByUserId: request.kind === "admin" ? request.userId : null,
    })
    .returning({ id: offers.id })
  await replaceOfferLocations(tx, offer.id, extraLocations)
  await tx
    .update(scanCandidates)
    .set({
      status: "published",
      offerId: offer.id,
      publicationKind: request.kind === "admin" ? "human" : "automatic",
      decidedAt: now,
      decidedByUserId: request.kind === "admin" ? request.userId : null,
      version: candidate.version + 1,
    })
    .where(eq(scanCandidates.id, candidate.id))
  return { ok: true, offerId: offer.id, created: true }
}

export async function publishCandidate(
  request: PublicationRequest,
): Promise<PublicationResult> {
  if (!isUuid(request.candidateId)) return conflict
  if (request.kind === "admin")
    return db.transaction((tx) => publish(tx, request))
  // Même ordre de verrouillage que les autres écritures du workflow (passage, dossier).
  if (!isUuid(request.runId) || !isUuid(request.token)) return conflict
  const result = await withRunClaim(request.runId, request.token, (tx, run) =>
    publish(tx, request, run),
  )
  return !result.ok && result.reason === "superseded" ? conflict : result
}
