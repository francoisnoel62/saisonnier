import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"

import {
  resetScan,
  insertScanCandidate,
  insertScanRun,
  enableScanSource,
} from "../../e2e/helpers/scan"
import {
  adminOfferInputSchema,
  emptyAdminOfferFormValues,
  offerInputContext,
} from "@/domain/offer-input"
import { buildProposal } from "@/domain/scan/proposal"
import { posting, observation } from "@/domain/scan/rules-fixtures"
import type { ScanMode } from "@/domain/scan/vocabulary"
import { db } from "@/lib/db"
import { companies, offers, scanCandidates, user } from "@/lib/db/schema"
import { getOfferFormReferentials } from "@/server/offers/employer-offers"

export const publicationNow = new Date("2026-10-24T10:00:00Z")
export async function createPublicationFixture(mode: ScanMode = "bootstrap") {
  await resetScan(db.$client)
  const adminId = `scan-publication-${randomUUID()}`
  await db.insert(user).values({
    id: adminId,
    name: "Admin test",
    email: `${adminId}@test.example`,
    role: "admin",
  })
  const [company] = await db
    .insert(companies)
    .values({ legalName: `Employeur fictif ${randomUUID()}` })
    .returning()
  const run = await insertScanRun(db.$client, {
    mode,
    startedAt: publicationNow,
  })
  await enableScanSource(db.$client, "belambra", { autoPublish: true })
  const extraction = posting({
    officialUrl: "https://recrute.belambra.fr/jobs/123-serveur",
    discoveryUrl: "https://recrute.belambra.fr/jobs/123-serveur",
    observations: [
      observation({ name: company.legalName }, "company"),
      observation(
        [{ communeName: "Chamonix", departmentCode: "74", country: "France" }],
        "locations",
      ),
      observation("active", "activity"),
    ],
  })
  const proposal = buildProposal(extraction, { referenceDate: "2026-10-24" })
  const candidate = await insertScanCandidate(db.$client, {
    firstRunId: run.id,
    sourceKey: "belambra",
    status: "to_review",
    title: extraction.title,
    proposal,
    officialUrl: extraction.officialUrl,
    discoveryUrl: extraction.discoveryUrl,
    lastFetchedAt: publicationNow,
    sourcePublishedDate: "2026-10-23",
    sourcePublishedAt: new Date("2026-10-23T08:00:00Z"),
    firstSeenAt: publicationNow,
  })
  const input = adminOfferInputSchema(
    offerInputContext(await getOfferFormReferentials(), "2026-10-24"),
  ).parse({
    ...emptyAdminOfferFormValues(),
    companyId: company.id,
    title: extraction.title,
    sourceUrl: extraction.officialUrl,
    sourceName: "Belambra",
    seasonalContract: true,
    season: "winter",
    periodKind: "dates",
    startDate: "2026-12-15",
    endDate: "2027-04-15",
    communeName: "Chamonix",
    departmentCode: "74",
    applyEmail: "rh@hotel.example",
  })
  return {
    adminId,
    company,
    run,
    extraction,
    proposal,
    candidate,
    input,
    request: {
      candidateId: candidate.id,
      kind: "admin" as const,
      userId: adminId,
      version: candidate.version,
      input,
      now: publicationNow,
    },
    scanRequest: {
      candidateId: candidate.id,
      kind: "scan" as const,
      runId: run.id,
      token: run.claimToken,
      now: publicationNow,
    },
    async discovered() {
      await db
        .update(scanCandidates)
        .set({
          status: "discovered",
          readyForReviewAt: null,
          deliveredRunId: null,
        })
        .where(eq(scanCandidates.id, candidate.id))
    },
    async cleanup() {
      await resetScan(db.$client)
      await db.delete(offers).where(eq(offers.companyId, company.id))
      await db.delete(companies).where(eq(companies.id, company.id))
      await db.delete(user).where(eq(user.id, adminId))
    },
  }
}
export type PublicationFixture = Awaited<
  ReturnType<typeof createPublicationFixture>
>
