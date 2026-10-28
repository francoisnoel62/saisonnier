import { and, eq, gt } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import { start } from "workflow/api"

import {
  deleteTestSources,
  enableScanSource,
  insertScanRun,
  resetScan,
} from "../../e2e/helpers/scan"
import { db } from "@/lib/db"
import {
  companies,
  offers,
  scanCandidates,
  scanReviews,
  scanRuns,
  scanRunSources,
  scanSourceRevisions,
  scanSources,
  user,
  type ScanRun,
} from "@/lib/db/schema"
import {
  createBootstrapRun,
  createDailyRun,
  renewClaim,
  requestStop,
} from "@/server/scan/runs"
import { initRunSources } from "@/server/scan/run-sources"
import { processSourceBatch } from "@/server/scan/orchestration"
import { sourceConfigHash } from "@/server/scan/sources/config-hash"
import { createScanFixtureServer } from "@/test/scan-fixture-server"
import { testScanSourceDefinitions, toSnapshot } from "@/test/scan-sources"

import { scanWorkflow } from "./scan"

// Workflow du scan exécuté en mémoire (@workflow/vitest) sur la base de test, contre le serveur
// de fixtures (plan scan 09). Contenus fictifs ; aucune source réelle n'est lue.
const origin = "http://localhost:3200"
const fixtures = createScanFixtureServer(3200)
const control = (action: string, query = "") =>
  fetch(`${origin}/controle/${action}${query}`, { method: "POST" })
let admin: string

// Version courante de la source `fixture`, posée par l'ensemencement des tests (son numéro dépend
// des exécutions précédentes) ; le test de version figée en ajoute une, retirée ensuite.
let fixtureRevision = 1
async function restoreFixtureSource() {
  await db
    .update(scanSources)
    .set({ revision: fixtureRevision })
    .where(eq(scanSources.key, "fixture"))
  await db
    .delete(scanSourceRevisions)
    .where(
      and(
        eq(scanSourceRevisions.sourceKey, "fixture"),
        gt(scanSourceRevisions.revision, fixtureRevision),
      ),
    )
}

beforeAll(async () => {
  await fixtures.listen()
  const [fixture] = await db
    .select({ revision: scanSources.revision })
    .from(scanSources)
    .where(eq(scanSources.key, "fixture"))
  fixtureRevision = fixture.revision
})
afterAll(async () => {
  await fixtures.close()
  await deleteTestSources(db.$client)
  await resetScan(db.$client)
})
beforeEach(async () => {
  await control("reinitialiser")
  await deleteTestSources(db.$client)
  await resetScan(db.$client)
  await restoreFixtureSource()
  await enableScanSource(db.$client, "fixture")
  admin = `scan-wf-${crypto.randomUUID()}`
  await db.insert(user).values({
    id: admin,
    name: "Admin test",
    email: `${admin}@test.example`,
    role: "admin",
  })
})
afterEach(async () => {
  await control("reinitialiser")
  await deleteTestSources(db.$client)
  await resetScan(db.$client)
  await restoreFixtureSource()
  await db.delete(user).where(eq(user.id, admin))
})

// Seconde source employeur sur la même origine (portail « /b/ »).
const sourceB = "e2e-source-b"
async function insertSourceB({ priority = 10 } = {}) {
  const definition = {
    ...toSnapshot({
      ...testScanSourceDefinitions(origin).fixture,
      label: "E2E — Source B",
    }),
    listUrls: [`${origin}/b/`],
    postingUrlPattern: `^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/b/jobs/[0-9]+$`,
  }
  await db.insert(scanSources).values({
    key: sourceB,
    label: "E2E — Source B",
    kind: "employer",
    adapter: "fixture",
    status: "ready",
    revision: 1,
    priority,
    enabled: true,
    employerName: "Employeur de test",
    employerWebsite: origin,
    reuseDecision: "accepted",
    reuseDecisionNote: "Acceptée pour un test.",
    reuseDecidedAt: new Date(),
  })
  await db.insert(scanSourceRevisions).values({
    sourceKey: sourceB,
    revision: 1,
    definition,
    complete: true,
    configHash: sourceConfigHash(definition),
  })
}

async function bootstrapRun() {
  const created = await createBootstrapRun({
    requestedBy: admin,
    now: new Date(),
  })
  if (!("run" in created) || !created.created)
    throw new Error("Remplissage initial non créé")
  return created.run
}
function launch(run: ScanRun) {
  return start(scanWorkflow, [run.id, run.claimToken])
}
async function currentRun(id: string) {
  const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, id))
  return run
}
async function runSources(id: string) {
  return db.select().from(scanRunSources).where(eq(scanRunSources.runId, id))
}
async function delivered(source = "fixture") {
  return db
    .select()
    .from(scanCandidates)
    .where(
      and(
        eq(scanCandidates.sourceKey, source),
        eq(scanCandidates.status, "to_review"),
      ),
    )
}
async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean) {
  const deadline = Date.now() + 60_000
  for (;;) {
    const value = await read()
    if (done(value)) return value
    if (Date.now() > deadline) throw new Error("Attente dépassée")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

describe("Scan §6 — workflow du scan", () => {
  it("livraison progressive : le premier dossier est en base avant la fin du passage", async () => {
    await control("suspendre", "?fiche=/jobs/3")
    const run = await bootstrapRun()
    const workflow = await launch(run)
    const first = await waitFor(delivered, (rows) => rows.length >= 1)
    expect(first[0].readyForReviewAt).toBeInstanceOf(Date)
    expect((await currentRun(run.id)).status).toBe("running")
    await control("liberer", "?fiche=/jobs/3")
    expect(await workflow.returnValue).toEqual({
      runId: run.id,
      outcome: "completed",
    })
    const finished = await currentRun(run.id)
    expect(finished).toMatchObject({ deliveredCount: 3, status: "completed" })
    expect(finished.firstDeliveredAt).toEqual(first[0].readyForReviewAt)
    expect(finished.reportSentAt).toBeInstanceOf(Date)
    const [source] = await runSources(run.id)
    expect(source).toMatchObject({
      status: "done",
      sourceRevision: fixtureRevision,
      listedCount: 3,
      fetchedCount: 3,
      deliveredCount: 3,
    })
    expect(source.requestCount).toBeGreaterThanOrEqual(4)
    expect(source.robotsDigest).toMatch(/^[0-9a-f]{64}$/)
  })

  it("remplissage initial : aucun dossier publié automatiquement, même source autorisée", async () => {
    await enableScanSource(db.$client, "fixture", { autoPublish: true })
    const run = await bootstrapRun()
    await (
      await launch(run)
    ).returnValue
    expect(await delivered()).toHaveLength(3)
    expect(
      await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.status, "published")),
    ).toHaveLength(0)
  })

  it("une source bloquée (403) : passage partiel, l'autre source livre ses dossiers", async () => {
    await insertSourceB()
    await control("refuser", "?prefixe=/b")
    const run = await bootstrapRun()
    expect(await (await launch(run)).returnValue).toMatchObject({
      outcome: "partial",
    })
    expect(await delivered()).toHaveLength(3)
    const sources = await runSources(run.id)
    expect(
      sources.find((source) => source.sourceKey === sourceB),
    ).toMatchObject({ status: "blocked", lastError: "accès refusé" })
    const [incident] = await db
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.groupKey, `source:${sourceB}:access_denied`))
    expect(incident).toMatchObject({ kind: "incident", status: "open" })
  })

  it("trois passages bloqués : la source est suspendue en fin de passage, une revue incident est ouverte", async () => {
    await insertSourceB()
    await control("refuser", "?prefixe=/b")
    // Deux passages quotidiens antérieurs, terminés avec la source bloquée.
    for (const day of [3, 2]) {
      const past = await insertScanRun(db.$client, {
        mode: "daily",
        status: "partial",
        startedAt: new Date(Date.now() - day * 86_400_000),
        finishedAt: new Date(Date.now() - day * 86_400_000 + 60_000),
      })
      await db.insert(scanRunSources).values({
        runId: past.id,
        sourceKey: sourceB,
        sourceRevision: 1,
        status: "blocked",
      })
    }
    const run = await bootstrapRun()
    await (
      await launch(run)
    ).returnValue
    const [source] = await db
      .select()
      .from(scanSources)
      .where(eq(scanSources.key, sourceB))
    expect(source.suspendedAt).toBeInstanceOf(Date)
    const [incident] = await db
      .select()
      .from(scanReviews)
      .where(eq(scanReviews.groupKey, `source:${sourceB}:suspendue`))
    expect(incident).toMatchObject({ kind: "incident", status: "open" })
  })

  it("source désactivée pendant le passage : elle passe Non couverte, les autres continuent", async () => {
    await insertSourceB()
    await control("suspendre", "?fiche=/jobs/2")
    const run = await bootstrapRun()
    const workflow = await launch(run)
    await waitFor(delivered, (rows) => rows.length >= 1)
    await db
      .update(scanSources)
      .set({ enabled: false })
      .where(eq(scanSources.key, "fixture"))
    expect(await workflow.returnValue).toMatchObject({ outcome: "partial" })
    const sources = await runSources(run.id)
    expect(sources.find((s) => s.sourceKey === "fixture")).toMatchObject({
      status: "skipped",
      lastError: "Désactivée pendant le passage",
    })
    expect(await delivered(sourceB)).toHaveLength(3)
  })

  it("source modifiée pendant le passage : le passage garde la version figée", async () => {
    const run = await bootstrapRun()
    await initRunSources(run.id, ["fixture"], run.claimToken)
    // Version 2 : le portail « /b/ ». Le passage a figé la version 1.
    const [row] = await db
      .select()
      .from(scanSourceRevisions)
      .where(
        and(
          eq(scanSourceRevisions.sourceKey, "fixture"),
          eq(scanSourceRevisions.revision, fixtureRevision),
        ),
      )
    const definition = {
      ...(row.definition as typeof row.definition & object),
      listUrls: [`${origin}/b/`],
      postingUrlPattern: `^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/b/jobs/[0-9]+$`,
    }
    await db.insert(scanSourceRevisions).values({
      sourceKey: "fixture",
      revision: fixtureRevision + 1,
      definition,
      complete: true,
      configHash: sourceConfigHash(definition),
    })
    await db
      .update(scanSources)
      .set({ revision: fixtureRevision + 1 })
      .where(eq(scanSources.key, "fixture"))
    await (
      await launch(run)
    ).returnValue
    const rows = await delivered()
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.title?.startsWith("Serveur"))).toBe(true)
    expect(rows.every((r) => r.sourceRevision === fixtureRevision)).toBe(true)
  })

  it("arrêt demandé : passage arrêté ; la reprise ne relivre rien", async () => {
    await control("suspendre", "?fiche=/jobs/2")
    const run = await bootstrapRun()
    const workflow = await launch(run)
    await waitFor(delivered, (rows) => rows.length >= 1)
    await requestStop(run.id, new Date())
    expect(await workflow.returnValue).toMatchObject({ outcome: "stopped" })
    expect(await currentRun(run.id)).toMatchObject({
      status: "stopped",
      deliveredCount: 1,
    })
    await control("liberer", "?fiche=/jobs/2")
    const renewed = await renewClaim(run.id, new Date())
    if (!renewed.ok) throw new Error("Reprise refusée")
    expect(await (await launch(renewed.run)).returnValue).toMatchObject({
      outcome: "completed",
    })
    expect(await currentRun(run.id)).toMatchObject({
      status: "completed",
      deliveredCount: 3,
      deadlineAt: run.deadlineAt,
    })
    expect(await delivered()).toHaveLength(3)
  })

  it("étape interrompue puis réessayée : compteur inchangé, décision de l'admin préservée", async () => {
    const run = await bootstrapRun()
    await (
      await launch(run)
    ).returnValue
    const [first] = await delivered()
    await db
      .update(scanCandidates)
      .set({
        status: "rejected",
        rejectionReason: "other",
        decidedAt: new Date(),
        decidedByUserId: admin,
      })
      .where(eq(scanCandidates.id, first.id))
    // Le SDK rejoue une étape dont la réponse s'est perdue : même passage, même jeton.
    await db
      .update(scanRuns)
      .set({ status: "running", finishedAt: null })
      .where(eq(scanRuns.id, run.id))
    await db
      .update(scanRunSources)
      .set({ status: "processing" })
      .where(eq(scanRunSources.runId, run.id))
    expect(
      await processSourceBatch(run.id, run.claimToken, "fixture"),
    ).toMatchObject({ processed: 0, delivered: 0, done: true })
    expect(await currentRun(run.id)).toMatchObject({ deliveredCount: 3 })
    const [kept] = await db
      .select()
      .from(scanCandidates)
      .where(eq(scanCandidates.id, first.id))
    expect(kept).toMatchObject({ status: "rejected", rejectionReason: "other" })
  })

  it("jeton remplacé : l'ancien workflow s'arrête sans écrire", async () => {
    await control("suspendre", "?fiche=/jobs/1")
    const run = await bootstrapRun()
    const workflow = await launch(run)
    // L'ancien run attend la fiche 1 (503 Retry-After) ; une reprise le remplace.
    await waitFor(
      () => runSources(run.id),
      (rows) => rows[0]?.status === "processing",
    )
    const renewed = await renewClaim(run.id, new Date(), {
      lostClaimToken: run.claimToken,
    })
    expect(renewed.ok).toBe(true)
    expect(await workflow.returnValue).toEqual({
      runId: run.id,
      outcome: "superseded",
    })
    expect(await delivered()).toHaveLength(0)
    expect((await currentRun(run.id)).deliveredCount).toBe(0)
  })
})

describe("Scan — passage quotidien", () => {
  it("source employeur autorisée : un dossier non conforme et un doublon potentiel vont en revue, rien n'est publié", async () => {
    await enableScanSource(db.$client, "fixture", { autoPublish: true })
    const [company] = await db
      .insert(companies)
      .values({ legalName: "Employeur de test" })
      .returning()
    try {
      // Une annonce déjà en ligne pour le premier poste : doublon potentiel.
      const year =
        new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 11 ? 1 : 0)
      await db.insert(offers).values({
        origin: "deposited",
        status: "published",
        publishedAt: new Date(),
        companyId: company.id,
        title: "Serveur saisonnier fictif 1 — hiver",
        season: "winter",
        communeName: "Chamonix",
        communeInseeCode: "74056",
        departmentCode: "74",
        startDate: `${year}-12-15`,
        endDate: `${year + 1}-04-15`,
        applyEmail: "rh@hotel.example",
      })
      // La fenêtre se termine au début du passage : les fiches, datées de leur lecture, doivent
      // la précéder.
      const startedAt = new Date(Date.now() + 10 * 60_000)
      const created = await createDailyRun({
        date: startedAt.toISOString().slice(0, 10),
        now: startedAt,
        trigger: "admin",
        requestedBy: admin,
      })
      if (!("run" in created)) throw new Error("Passage quotidien non créé")
      await (
        await launch(created.run)
      ).returnValue
      const candidates = await db
        .select()
        .from(scanCandidates)
        .where(eq(scanCandidates.sourceKey, "fixture"))
      // La source locale n'est pas une source officielle (https, sans port) : point bloquant, revue.
      expect(candidates.map((c) => c.status)).toEqual([
        "to_review",
        "to_review",
        "to_review",
      ])
      expect(
        candidates.every((c) =>
          c.issues.some((issue) => issue.code === "official_source"),
        ),
      ).toBe(true)
      const first = candidates.find(
        (c) => c.title === "Serveur saisonnier fictif 1 — hiver",
      )!
      const [duplicate] = await db
        .select()
        .from(scanReviews)
        .where(
          and(
            eq(scanReviews.kind, "duplicate"),
            eq(scanReviews.candidateId, first.id),
          ),
        )
      expect(duplicate).toMatchObject({ status: "open" })
    } finally {
      await resetScan(db.$client)
      await db.delete(offers).where(eq(offers.companyId, company.id))
      await db.delete(companies).where(eq(companies.id, company.id))
    }
  })
})
