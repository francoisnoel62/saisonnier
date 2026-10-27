import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  insertScanCandidate,
  insertScanRun,
  resetScan,
} from "../../../../e2e/helpers/scan"
import { buildProposal } from "@/domain/scan/proposal"
import { observation, posting } from "@/domain/scan/rules-fixtures"
import { emptySourceFormValues } from "@/domain/scan/source-form"
import { db } from "@/lib/db"
import {
  companies,
  companyMembers,
  scanReviews,
  scanSourceEvents,
  user,
} from "@/lib/db/schema"
import { createMembership } from "@/server/companies/membership"

import { resolvePlace } from "../places"
import { context } from "./adapter-test-fixtures"
import {
  decideEmployerLead,
  learnPlaceAlias,
  markEmployerWithoutPortal,
  sourceCoverage,
} from "./learning"
import { getScanSourceDefinition } from "./registry"
import { createSource } from "./writes"

const adminId = `learning-${randomUUID()}`
const siren = "552100554"
let runId: string
beforeEach(async () => {
  await resetScan(db.$client)
  runId = (
    await insertScanRun(db.$client, {
      status: "completed",
      finishedAt: new Date(),
    })
  ).id
  await db
    .insert(user)
    .values({
      id: adminId,
      name: "Admin apprentissage",
      email: `${adminId}@test.example`,
      role: "admin",
    })
    .onConflictDoNothing()
})
afterAll(async () => {
  await resetScan(db.$client)
  await db.delete(companyMembers).where(eq(companyMembers.userId, adminId))
  await db.delete(companies).where(eq(companies.siren, siren))
  await db.delete(user).where(eq(user.id, adminId))
})

async function discoveryCandidate({
  employer = "SAS Chalet des Neiges",
  employerSiren,
  officialUrl,
  communeName = "Les Menuires",
}: {
  employer?: string
  employerSiren?: string
  officialUrl?: string
  communeName?: string
} = {}) {
  const extraction = posting({
    officialUrl,
    discoveryUrl: `https://candidat.francetravail.fr/offres/recherche/detail/${randomUUID().slice(0, 7).toUpperCase()}`,
    observations: [
      observation(
        { name: employer, ...(employerSiren ? { siren: employerSiren } : {}) },
        "company",
      ),
      observation([{ communeName, country: "France" }], "locationCandidates"),
    ],
  })
  return insertScanCandidate(db.$client, {
    firstRunId: runId,
    sourceKey: "france-travail",
    status: "to_review",
    title: extraction.title,
    proposal: buildProposal(extraction, { referenceDate: "2026-10-27" }),
    officialUrl: officialUrl ?? null,
    discoveryUrl: extraction.discoveryUrl,
  })
}

describe("lieux mémorisés", () => {
  it("un alias appris depuis un dossier établit le lieu au passage suivant", async () => {
    const candidate = await discoveryCandidate()
    expect(candidate.proposal?.locations.status).toBe("to_verify")
    expect(
      await learnPlaceAlias(
        candidate.id,
        {
          name: "Les Menuires",
          communeName: "Les Belleville",
          departmentCode: "73",
          inseeCode: "73257",
        },
        adminId,
      ),
    ).toMatchObject({ ok: true, key: "france-travail" })
    const definition = (await getScanSourceDefinition("france-travail"))!
    expect(definition.revision).toBe(2)
    expect(definition.placeAliases["Les Menuires"]).toEqual({
      inseeCode: "73257",
      name: "Les Belleville",
      departmentCode: "73",
    })
    const resolved = await resolvePlace(
      { name: "LES MENUIRES" },
      context(definition),
    )
    expect(resolved).toMatchObject({
      status: "established",
      value: [{ communeName: "Les Belleville", inseeCode: "73257" }],
    })
    const events = await db
      .select()
      .from(scanSourceEvents)
      .where(
        and(
          eq(scanSourceEvents.sourceKey, "france-travail"),
          eq(scanSourceEvents.kind, "alias_learned"),
        ),
      )
    expect(events[0].details).toMatchObject({ candidateId: candidate.id })
    expect(
      await learnPlaceAlias(
        candidate.id,
        {
          name: "Station",
          communeName: "Les Belleville",
          departmentCode: "74",
          inseeCode: "73257",
        },
        adminId,
      ),
    ).toMatchObject({ ok: false })
  })
})

describe("pistes employeur", () => {
  it("une piste n'est jamais recréée ; ses occurrences augmentent ; un portail employeur n'en ouvre pas", async () => {
    const first = await discoveryCandidate({
      employer: "SAS Chalet des Neiges",
    })
    const second = await discoveryCandidate({ employer: "Chalet des neiges" })
    const opened = await markEmployerWithoutPortal(first.id, adminId)
    expect(opened).toMatchObject({ ok: true })
    expect(await markEmployerWithoutPortal(first.id, adminId)).toEqual(opened)
    expect(await markEmployerWithoutPortal(second.id, adminId)).toEqual(opened)
    const [review] = await db
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.kind, "employer_lead"))
    expect(review).toMatchObject({
      groupKey: "employer:chalet des neiges",
      occurrences: 2,
      status: "open",
    })
    expect(
      await decideEmployerLead(
        review.id,
        { decision: "dismissed", note: "" },
        adminId,
      ),
    ).toMatchObject({ ok: false })
    await decideEmployerLead(
      review.id,
      {
        decision: "invited",
        note: "Appel du 27/10, email envoyé par le fondateur.",
      },
      adminId,
    )
    // Un dossier de plus après l'invitation : la même piste, jamais une nouvelle.
    const third = await discoveryCandidate({
      employer: "Chalet des Neiges SARL",
    })
    await markEmployerWithoutPortal(third.id, adminId)
    const reviews = await db
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.kind, "employer_lead"))
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({ occurrences: 3, status: "resolved" })
  })

  it("un compte employeur créé avec le même SIREN résout la piste", async () => {
    const candidate = await discoveryCandidate({
      employer: "Hôtel du Glacier",
      employerSiren: siren,
    })
    await markEmployerWithoutPortal(candidate.id, adminId)
    await createMembership(adminId, {
      legalName: "Hôtel du Glacier",
      displayName: null,
      siren,
      siret: null,
      nafCode: "55.10Z",
      nafLabel: null,
      communeName: "Chamonix",
      website: null,
      jobTitle: "Gérant",
      relationship: "executive",
      relationshipDetails: null,
      phone: "0699980000",
    } as never)
    const [review] = await db
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.groupKey, `employer:${siren}`))
    expect(review).toMatchObject({
      status: "resolved",
      decision: { decision: "account_created" },
    })
  })
})

describe("couverture et provenance", () => {
  it("la couverture monte quand une source employeur est créée ; la source garde son dossier d'origine", async () => {
    const candidate = await discoveryCandidate({
      employer: "Camping des Pins",
      officialUrl: "https://recrute.camping-pins-test.example/offres/1",
    })
    expect((await sourceCoverage("france-travail")).last30).toMatchObject({
      covered: 0,
      unknown: 1,
    })
    const created = await createSource(
      {
        ...emptySourceFormValues(),
        label: "Camping des Pins",
        manualHosts: "recrute.camping-pins-test.example",
      },
      adminId,
      { originCandidateId: candidate.id },
    )
    if (!created.ok) throw new Error(created.message)
    expect((await sourceCoverage("france-travail")).last30).toMatchObject({
      covered: 1,
      unknown: 0,
      rate: 1,
    })
    const [event] = await db
      .select()
      .from(scanSourceEvents)
      .where(
        and(
          eq(scanSourceEvents.sourceKey, created.key),
          eq(scanSourceEvents.kind, "created"),
        ),
      )
    expect(event.details).toMatchObject({ originCandidateId: candidate.id })
  })
})
