import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  enableScanSource,
  insertScanCandidate,
  insertScanRun,
  resetScan,
} from "../../../../e2e/helpers/scan"
import {
  emptySourceFormValues,
  sourceFormDefaults,
  type SourceFormValues,
} from "@/domain/scan/source-form"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanSourceEvents,
  scanSourceHosts,
  scanSourceRevisions,
  scanSources,
  user,
} from "@/lib/db/schema"

const mocks = vi.hoisted(() => ({ probe: vi.fn(), sample: vi.fn() }))
// Aucune lecture réseau : sonde et échantillon simulés.
vi.mock("../probe", () => ({ probeScanSource: mocks.probe }))
vi.mock("../sample", () => ({ sampleScanSource: mocks.sample }))

import { getScanSourceDefinition, getScanSource } from "./registry"
import { runSourceTest } from "./tests"
import {
  createSource,
  decideReuse,
  deleteSource,
  restoreRevision,
  reviseSource,
  setSourceSwitch,
  transitionSource,
} from "./writes"

const adminId = `sources-${crypto.randomUUID()}`
function sample(ok = true) {
  return {
    sourceKey: "x",
    deploymentUrl: "http://localhost:3100",
    sampledAt: new Date().toISOString(),
    extractorVersion: "factorial@1",
    items: [],
    coverage: {},
    ...(ok ? {} : { failure: "Accès refusé" }),
  }
}
beforeEach(async () => {
  await resetScan(db.$client)
  await db
    .insert(user)
    .values({
      id: adminId,
      name: "Admin sources",
      email: `${adminId}@test.example`,
      role: "admin",
    })
    .onConflictDoNothing()
  mocks.sample.mockResolvedValue(sample())
  mocks.probe.mockResolvedValue({
    sourceKey: "x",
    deploymentUrl: "http://localhost:3100",
    probedAt: new Date().toISOString(),
    requests: [],
  })
})
afterAll(async () => {
  await resetScan(db.$client)
  await db.delete(user).where(eq(user.id, adminId))
})

async function vvfValues() {
  const definition = (await getScanSourceDefinition("vvf"))!
  return sourceFormDefaults(definition)
}
function portal(label: string, host: string): SourceFormValues {
  return {
    ...emptySourceFormValues(),
    label,
    employerName: label,
    employerWebsite: `https://www.${host}/`,
    adapter: "teamtailor",
    portalUrl: `https://recrute.${host}`,
  }
}

describe("versions", () => {
  it("deux modifications concurrentes : la seconde reçoit conflict", async () => {
    const values = await vvfValues()
    const { version } = (await getScanSource("vvf"))!
    const results = await Promise.all([
      reviseSource("vvf", version, { ...values, label: "VVF A" }, adminId),
      reviseSource("vvf", version, { ...values, label: "VVF B" }, adminId),
    ])
    expect(results.map((result) => result.ok).sort()).toEqual([false, true])
    expect(results.find((result) => !result.ok)).toMatchObject({
      reason: "conflict",
    })
  })

  it("une modification sans changement ne crée aucune version", async () => {
    const { version } = (await getScanSource("vvf"))!
    expect(
      await reviseSource("vvf", version, await vvfValues(), adminId),
    ).toMatchObject({ ok: true, version })
    expect(
      await db
        .select()
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, "vvf")),
    ).toHaveLength(1)
  })

  it("modification sensible d'une source prête sans test : needs_test ; avec un échantillon réussi de la même empreinte : version N+1", async () => {
    await enableScanSource(db.$client, "vvf")
    const changed = {
      ...(await vvfValues()),
      portalUrl: "https://vvf-villages.factorial.fr",
    }
    let { version } = (await getScanSource("vvf"))!
    expect(await reviseSource("vvf", version, changed, adminId)).toMatchObject({
      ok: false,
      reason: "needs_test",
    })
    // Un échantillon d'une autre configuration ne vaut pas test.
    const other = await runSourceTest("vvf", "sample", adminId)
    expect(other).toMatchObject({ ok: true, succeeded: true })
    expect(
      await reviseSource("vvf", version, changed, adminId, {
        testId: other.ok ? other.testId : undefined,
      }),
    ).toMatchObject({ ok: false, reason: "needs_test" })
    const tested = await runSourceTest("vvf", "sample", adminId, {
      values: changed,
      now: new Date(Date.now() + 31_000),
    })
    expect(tested).toMatchObject({ ok: true, succeeded: true })
    ;({ version } = (await getScanSource("vvf"))!)
    const saved = await reviseSource("vvf", version, changed, adminId, {
      testId: tested.ok ? tested.testId : undefined,
    })
    expect(saved).toMatchObject({ ok: true, revision: 2 })
    expect(await getScanSourceDefinition("vvf")).toMatchObject({
      revision: 2,
      listUrls: ["https://vvf-villages.factorial.fr/"],
      officialHosts: ["vvf-villages.factorial.fr"],
    })
    // Les hôtes suivent la version courante.
    expect(
      (
        await db
          .select()
          .from(scanSourceHosts)
          .where(eq(scanSourceHosts.sourceKey, "vvf"))
      ).map((row) => row.host),
    ).toEqual(["vvf-villages.factorial.fr"])
  })

  it("identité d'une source prête : motif exigé ; configuration incomplète refusée", async () => {
    await enableScanSource(db.$client, "vvf")
    const values = await vvfValues()
    const { version } = (await getScanSource("vvf"))!
    expect(
      await reviseSource(
        "vvf",
        version,
        { ...values, label: "VVF Villages" },
        adminId,
      ),
    ).toMatchObject({ ok: false, fieldErrors: { note: expect.any(Array) } })
    expect(
      await reviseSource(
        "vvf",
        version,
        {
          ...values,
          affiliationUrl: "",
          affiliationNote: "",
          affiliationCheckedAt: "",
        },
        adminId,
      ),
    ).toMatchObject({ ok: false, reason: "incomplete" })
    expect(
      await reviseSource(
        "vvf",
        version,
        { ...values, label: "VVF Villages", note: "Nouveau nom commercial." },
        adminId,
      ),
    ).toMatchObject({ ok: true, revision: 2 })
  })

  it("retour à une version : version N+1, copie de l'ancienne", async () => {
    const values = await vvfValues()
    let { version } = (await getScanSource("vvf"))!
    await reviseSource(
      "vvf",
      version,
      { ...values, label: "VVF modifiée" },
      adminId,
    )
    ;({ version } = (await getScanSource("vvf"))!)
    expect(await restoreRevision("vvf", version, 1, adminId)).toMatchObject({
      ok: true,
      revision: 3,
    })
    expect(await getScanSource("vvf")).toMatchObject({
      label: "VVF",
      revision: 3,
    })
    const [event] = await db
      .select()
      .from(scanSourceEvents)
      .where(
        and(
          eq(scanSourceEvents.sourceKey, "vvf"),
          eq(scanSourceEvents.kind, "revised"),
          eq(scanSourceEvents.revision, 3),
        ),
      )
    expect(event.details).toMatchObject({ restoredFrom: 1, revision: 3 })
    expect(event.actorUserId).toBe(adminId)
  })
})

describe("hôtes et cycle de vie", () => {
  it("deux sources sur le même hôte, même en concurrence : la seconde est refusée", async () => {
    const results = await Promise.all([
      createSource(portal("Hôtel Alpha", "alpha-test.example"), adminId),
      createSource(portal("Hôtel Alpha bis", "alpha-test.example"), adminId),
    ])
    expect(results.map((result) => result.ok).sort()).toEqual([false, true])
    expect(results.find((result) => !result.ok)).toMatchObject({
      reason: "host_taken",
      message: expect.stringContaining("recrute.alpha-test.example"),
    })
    expect(
      await createSource(
        {
          ...portal("Belambra bis", "x"),
          portalUrl: "https://recrute.belambra.fr",
        },
        adminId,
      ),
    ).toMatchObject({
      reason: "host_taken",
      message: expect.stringContaining("Belambra"),
    })
  })

  it("une clé n'est jamais réattribuée", async () => {
    const first = await createSource(
      portal("Camping Bêta", "beta-test.example"),
      adminId,
    )
    const second = await createSource(
      { ...portal("Camping Bêta", "beta2-test.example") },
      adminId,
    )
    expect(first).toMatchObject({ ok: true, key: "camping-beta" })
    expect(second).toMatchObject({ ok: true, key: "camping-beta-2" })
  })

  it("archiver libère les hôtes ; restaurer échoue si un hôte a été repris", async () => {
    let { version } = (await getScanSource("vvf"))!
    expect(
      await transitionSource("vvf", version, "archive", adminId),
    ).toMatchObject({ ok: true })
    expect(
      await db
        .select()
        .from(scanSourceHosts)
        .where(eq(scanSourceHosts.sourceKey, "vvf")),
    ).toEqual([])
    const taken = await createSource(
      {
        ...emptySourceFormValues(),
        label: "VVF reprise",
        adapter: "factorial",
        portalUrl: "https://vvfrecrute.factorial.fr",
      },
      adminId,
    )
    expect(taken).toMatchObject({ ok: true })
    ;({ version } = (await getScanSource("vvf"))!)
    expect(
      await transitionSource("vvf", version, "restore", adminId),
    ).toMatchObject({ ok: false, reason: "host_taken" })
    expect(await getScanSource("vvf")).toMatchObject({ status: "archived" })
  })

  it("archiver peut rejeter les dossiers à vérifier (source_withdrawn)", async () => {
    const run = await insertScanRun(db.$client)
    const candidate = await insertScanCandidate(db.$client, {
      sourceKey: "belambra",
      firstRunId: run.id,
      status: "to_review",
    })
    const { version } = (await getScanSource("belambra"))!
    expect(
      await transitionSource("belambra", version, "archive", adminId, {
        rejectPending: true,
      }),
    ).toMatchObject({ ok: true })
    expect(
      (
        await db
          .select()
          .from(scanCandidates)
          .where(eq(scanCandidates.id, candidate.id))
      )[0],
    ).toMatchObject({ status: "rejected", rejectionReason: "source_withdrawn" })
  })

  it("écarter exige un motif ; réexaminer le retire ; les interrupteurs tombent", async () => {
    await enableScanSource(db.$client, "vvf", { autoPublish: true })
    let { version } = (await getScanSource("vvf"))!
    expect(
      await transitionSource("vvf", version, "reject", adminId, {
        reason: "court",
      }),
    ).toMatchObject({ ok: false, reason: "blocked" })
    expect(
      await transitionSource("vvf", version, "reject", adminId, {
        reason: "Autorisation de reprise refusée par écrit.",
      }),
    ).toMatchObject({ ok: true })
    expect(await getScanSource("vvf")).toMatchObject({
      status: "rejected",
      enabled: false,
      dailyEnabled: false,
      autoPublish: false,
    })
    ;({ version } = (await getScanSource("vvf"))!)
    await transitionSource("vvf", version, "reexamine", adminId)
    expect(await getScanSource("vvf")).toMatchObject({
      status: "draft",
      rejectionReason: null,
    })
  })

  it("supprimer une source citée : in_use ; sans historique : supprimée", async () => {
    const created = await createSource(
      portal("Gîte Gamma", "gamma-test.example"),
      adminId,
    )
    if (!created.ok) throw new Error(created.message)
    const run = await insertScanRun(db.$client)
    await insertScanCandidate(db.$client, {
      sourceKey: created.key,
      firstRunId: run.id,
    })
    expect(await deleteSource(created.key, adminId)).toMatchObject({
      ok: false,
      reason: "in_use",
    })
    expect(await deleteSource("sandaya", adminId)).toMatchObject({ ok: true })
    expect(await getScanSource("sandaya")).toBeNull()
    expect(
      await db
        .select()
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, "sandaya")),
    ).toEqual([])
  })
})

describe("tests de source", () => {
  it("second test en moins de 30 s : cooldown", async () => {
    expect(await runSourceTest("belambra", "probe", adminId)).toMatchObject({
      ok: true,
    })
    expect(await runSourceTest("belambra", "sample", adminId)).toMatchObject({
      ok: false,
      reason: "cooldown",
      message: expect.stringMatching(/Patientez \d+ s/),
    })
  })

  it("au-delà de 20 tests, les plus anciens sont purgés, jamais les décisions", async () => {
    const old = Date.now() - 24 * 60 * 60 * 1000
    await db.insert(scanSourceEvents).values(
      Array.from({ length: 25 }, (_, index) => ({
        sourceKey: "belambra",
        kind: "probed" as const,
        details: { configHash: "ancien", status: "done", ok: true },
        createdAt: new Date(old + index * 1000),
      })),
    )
    const { version } = (await getScanSource("belambra"))!
    await decideReuse(
      "belambra",
      version,
      { decision: "authorized", note: "Autorisation écrite reçue le 27/10." },
      adminId,
    )
    await runSourceTest("belambra", "probe", adminId)
    const events = await db
      .select()
      .from(scanSourceEvents)
      .where(eq(scanSourceEvents.sourceKey, "belambra"))
    expect(
      events.filter((event) =>
        ["probed", "sampled", "detected"].includes(event.kind),
      ),
    ).toHaveLength(20)
    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["imported", "reuse_decided"]),
    )
  })

  it("une source écartée, archivée ou incomplète n'est pas testée", async () => {
    expect(await runSourceTest("sandaya", "probe", adminId)).toMatchObject({
      ok: false,
      reason: "incomplete",
    })
    expect(mocks.probe).not.toHaveBeenCalled()
  })
})

describe("les portes valent aussi hors de l'écran", () => {
  it("marquer prête exige la qualification ; une décision défavorable repasse en brouillon", async () => {
    let { version } = (await getScanSource("vvf"))!
    const refused = await transitionSource(
      "vvf",
      version,
      "mark_ready",
      adminId,
    )
    expect(refused).toMatchObject({
      ok: false,
      reason: "blocked",
      message: expect.stringContaining("À qualifier"),
    })
    await decideReuse(
      "vvf",
      version,
      { decision: "authorized", note: "Autorisation écrite reçue le 27/10." },
      adminId,
    )
    await runSourceTest("vvf", "sample", adminId)
    ;({ version } = (await getScanSource("vvf"))!)
    expect(
      await transitionSource("vvf", version, "mark_ready", adminId),
    ).toMatchObject({ ok: true })
    ;({ version } = (await getScanSource("vvf"))!)
    await setSourceSwitch("vvf", "enabled", true, adminId)
    ;({ version } = (await getScanSource("vvf"))!)
    expect(
      await decideReuse(
        "vvf",
        version,
        { decision: "refused", note: "Autorisation retirée par l'employeur." },
        adminId,
      ),
    ).toMatchObject({ ok: true })
    expect(await getScanSource("vvf")).toMatchObject({
      status: "draft",
      enabled: false,
      reuseDecision: "refused",
      reuseDecidedByUserId: adminId,
    })
  })

  it("une découverte ne passe en quotidien qu'avec une justification, retirée avec elle", async () => {
    await enableScanSource(db.$client, "france-travail")
    expect(
      await setSourceSwitch("france-travail", "dailyEnabled", true, adminId),
    ).toMatchObject({ ok: false })
    let { version } = (await getScanSource("france-travail"))!
    await decideReuse(
      "france-travail",
      version,
      {
        decision: "accepted",
        note: "Remplissage initial accepté par le fondateur.",
        scheduledAccessBasis: "Accès à l'API officielle obtenu le 27/10.",
      },
      adminId,
    )
    expect(
      await setSourceSwitch("france-travail", "dailyEnabled", true, adminId),
    ).toMatchObject({ ok: true })
    ;({ version } = (await getScanSource("france-travail"))!)
    await decideReuse(
      "france-travail",
      version,
      {
        decision: "accepted",
        note: "Justification retirée en attendant l'API.",
      },
      adminId,
    )
    expect(await getScanSource("france-travail")).toMatchObject({
      dailyEnabled: false,
      scheduledAccessBasis: null,
    })
  })

  it("un portail employeur ne peut pas être hébergé sur un domaine exclu", async () => {
    expect(
      await createSource(
        {
          ...emptySourceFormValues(),
          label: "Welcome",
          adapter: "teamtailor",
          portalUrl: "https://www.welcometothejungle.com",
        },
        adminId,
      ),
    ).toMatchObject({ ok: false, reason: "blocked" })
    expect(
      await db
        .select()
        .from(scanSources)
        .where(inArray(scanSources.label, ["Welcome"])),
    ).toEqual([])
  })
})
