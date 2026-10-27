import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  enableScanSource,
  insertScanCandidate,
  insertScanRun,
  resetScan,
} from "../../../../e2e/helpers/scan"
import { deriveSourceConfig } from "@/domain/scan/adapter-catalog"
import type { ScanSourceSnapshot } from "@/domain/scan/source"
import { db } from "@/lib/db"
import {
  scanCandidates,
  scanRunSources,
  scanSourceEvents,
  scanSourceHosts,
  scanSourceRevisions,
  scanSources,
} from "@/lib/db/schema"
import {
  createPublicationFixture,
  type PublicationFixture,
} from "@/test/scan-publication"
import {
  legacyAdapterParams,
  legacyScanSourceDefinitions,
  replaySourceSeed,
  sourceSeedStatements,
  toSnapshot,
} from "@/test/scan-sources"

import { publishCandidate } from "../publication"
import { initRunSources } from "../run-sources"
import { recordListedPosting } from "../candidates"
import { sourceConfigHash } from "./config-hash"
import {
  getScanSourceDefinition,
  listRunnableSources,
  listScanSources,
} from "./registry"

beforeEach(() => resetScan(db.$client))
afterAll(() => resetScan(db.$client))

const migratedKeys = ["france-travail", "belambra", "vvf", "ms-vacances"]

describe("reprise du registre en code (migration 0018)", () => {
  it.each(migratedKeys)(
    "les sources migrées reproduisent le registre en code : %s",
    async (key) => {
      const definition = await getScanSourceDefinition(key)
      const legacy = legacyScanSourceDefinitions()[key]
      expect(definition).toEqual({
        ...legacy,
        revision: 1,
        adapterParams: legacyAdapterParams[key],
      })
    },
  )

  it.each(migratedKeys)(
    "derive reproduit listes, motif et hôtes migrés : %s",
    async (key) => {
      const definition = (await getScanSourceDefinition(key))!
      expect(
        deriveSourceConfig(definition.adapter, definition.adapterParams),
      ).toEqual({
        listUrls: definition.listUrls,
        postingUrlPattern: definition.postingUrlPattern,
        officialHosts: definition.officialHosts,
      })
      const [revision] = await db
        .select()
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, key))
      expect(revision.configHash).toBe(
        sourceConfigHash(revision.definition as ScanSourceSnapshot),
      )
    },
  )

  it("statuts, décisions et hôtes de la reprise ; pistes écartées conservées", async () => {
    const sources = await db
      .select()
      .from(scanSources)
      .orderBy(scanSources.priority, scanSources.key)
    expect(
      sources.map((source) => [
        source.key,
        source.status,
        source.role,
        source.reuseDecision,
      ]),
    ).toEqual([
      ["france-travail", "ready", "primary", "accepted"],
      ["fixture", "ready", "reserve", "accepted"],
      ["belambra", "draft", "reserve", "pending"],
      ["vvf", "draft", "reserve", "pending"],
      ["ms-vacances", "draft", "reserve", "pending"],
      ["accor-smartrecruiters", "rejected", "reserve", "pending"],
      ["pierre-et-vacances", "rejected", "reserve", "pending"],
      ["sandaya", "rejected", "reserve", "pending"],
    ])
    const franceTravail = sources[0]
    expect(franceTravail).toMatchObject({
      reuseDecidedByUserId: null,
      scheduledAccessBasis: null,
      dailyEnabled: false,
    })
    expect(franceTravail.reuseDecisionNote).toContain(
      "Passages programmés exclus",
    )
    for (const source of sources.filter((row) => row.status === "rejected"))
      expect(await getScanSourceDefinition(source.key)).toBeNull()
    expect(
      (await db.select().from(scanSourceHosts)).map((row) => row.host).sort(),
    ).toEqual([
      "api.smartrecruiters.com",
      "candidat.francetravail.fr",
      "emploi.ms-vacances.com",
      "recrute.belambra.fr",
      "recrutement.sandaya.jobs",
      "vvfrecrute.factorial.fr",
      "www.groupepvcp.com",
    ])
    const imported = await db
      .select()
      .from(scanSourceEvents)
      .where(eq(scanSourceEvents.kind, "imported"))
    expect(imported.map((event) => event.sourceKey).sort()).toEqual(
      sources
        .map((source) => source.key)
        .filter((key) => key !== "fixture")
        .sort(),
    )
    expect(imported.every((event) => event.actorUserId === null)).toBe(true)
  })

  it("chaque source pointe une version existante", async () => {
    const orphans = await db.execute(sql`
      select s.key from scan_sources s
      where not exists (
        select 1 from scan_source_revisions r
        where r.source_key = s.key and r.revision = s.revision
      )`)
    expect(orphans.rows).toEqual([])
  })

  it("rejouer 0018 ne change rien à un registre déjà repris", async () => {
    await enableScanSource(db.$client, "france-travail")
    const before = await db.select().from(scanSources).orderBy(scanSources.key)
    const events = await db.select().from(scanSourceEvents)
    await replaySourceSeed(db.$client)
    expect(
      await db.select().from(scanSources).orderBy(scanSources.key),
    ).toEqual(before)
    expect(await db.select().from(scanSourceEvents)).toHaveLength(events.length)
  })

  it("0018 rejoué conserve l'activation d'une source prête, désactive avec trace une source non prête ou une découverte en publication automatique", async () => {
    // Retour temporaire au schéma d'avant 0019, dans une transaction annulée : lignes d'état
    // du registre en code (clé et interrupteurs seuls).
    const client = await db.$client.connect()
    try {
      await client.query("begin")
      await client.query(`
        alter table scan_sources alter column label drop not null,
          alter column kind drop not null, alter column revision drop not null,
          drop constraint scan_sources_switches, drop constraint scan_sources_discovery`)
      await client.query(
        "delete from scan_sources where key in ('france-travail', 'vvf', 'belambra')",
      )
      await client.query(`
        insert into scan_sources (key, enabled, auto_publish) values
          ('france-travail', true, true), ('vvf', true, false), ('belambra', false, false),
          ('ancienne-cle', true, false)`)
      for (const statement of sourceSeedStatements())
        await client.query(statement)
      const { rows } = await client.query<{
        key: string
        status: string
        enabled: boolean
        auto_publish: boolean
      }>(
        "select key, status, enabled, auto_publish from scan_sources where key in ('france-travail', 'vvf', 'belambra', 'ancienne-cle') order by key",
      )
      expect(rows).toEqual([
        {
          key: "belambra",
          status: "draft",
          enabled: false,
          auto_publish: false,
        },
        {
          key: "france-travail",
          status: "ready",
          enabled: true,
          auto_publish: false,
        },
        { key: "vvf", status: "draft", enabled: false, auto_publish: false },
      ])
      const { rows: switched } = await client.query<{
        source_key: string
        details: { flag: string; value: boolean; reason: string }
      }>(
        "select source_key, details from scan_source_events where kind = 'switched' order by source_key, details->>'flag'",
      )
      expect(switched).toEqual([
        {
          source_key: "france-travail",
          details: {
            flag: "autoPublish",
            value: false,
            reason: expect.stringContaining("découverte"),
          },
        },
        {
          source_key: "vvf",
          details: {
            flag: "enabled",
            value: false,
            reason: expect.stringContaining("prête"),
          },
        },
      ])
    } finally {
      await client.query("rollback")
      client.release()
    }
  })

  it("une clé citée par un dossier mais absente du registre devient une source archivée de substitution", async () => {
    const client = await db.$client.connect()
    try {
      await client.query("begin")
      await client.query(
        "alter table scan_candidates drop constraint scan_candidates_source_key_scan_sources_key_fk",
      )
      const run = await insertScanRun(db.$client)
      await client.query(
        `insert into scan_candidates (source_key, identity_key, discovery_url, listing_hash, first_run_id)
         values ('uninitialized', 'id-1', 'https://hotel.example/1', 'h', $1)`,
        [run.id],
      )
      for (const statement of sourceSeedStatements())
        await client.query(statement)
      const { rows } = await client.query(
        `select s.key, s.label, s.status, r.complete, e.kind
         from scan_sources s
         join scan_source_revisions r on r.source_key = s.key and r.revision = s.revision
         join scan_source_events e on e.source_key = s.key
         where s.key = 'uninitialized'`,
      )
      expect(rows).toEqual([
        {
          key: "uninitialized",
          label: "uninitialized",
          status: "archived",
          complete: false,
          kind: "imported",
        },
      ])
    } finally {
      await client.query("rollback")
      client.release()
    }
  })
})

describe("intégrité du registre", () => {
  it("un passage garde la version figée après une modification", async () => {
    await enableScanSource(db.$client, "belambra")
    const run = await insertScanRun(db.$client, {
      status: "running",
      startedAt: new Date(),
    })
    expect(
      await initRunSources(run.id, ["belambra", "fixture"], run.claimToken),
    ).toEqual({ ok: true })
    // Nouvelle version de Belambra pendant le passage.
    const snapshot = toSnapshot((await getScanSourceDefinition("belambra"))!)
    const next = { ...snapshot, label: "Belambra (modifiée)" }
    await db.insert(scanSourceRevisions).values({
      sourceKey: "belambra",
      revision: 2,
      definition: next,
      complete: true,
      configHash: sourceConfigHash(next),
    })
    await db
      .update(scanSources)
      .set({ revision: 2, label: next.label })
      .where(eq(scanSources.key, "belambra"))
    const [frozen] = await db
      .select()
      .from(scanRunSources)
      .where(
        and(
          eq(scanRunSources.runId, run.id),
          eq(scanRunSources.sourceKey, "belambra"),
        ),
      )
    expect(frozen.sourceRevision).toBe(1)
    expect(
      await getScanSourceDefinition("belambra", {
        revision: frozen.sourceRevision,
      }),
    ).toMatchObject({ revision: 1, label: "Belambra" })
    // La reprise d'un passage garde la version déjà figée.
    await initRunSources(run.id, ["belambra"], run.claimToken)
    const [again] = await db
      .select()
      .from(scanRunSources)
      .where(
        and(
          eq(scanRunSources.runId, run.id),
          eq(scanRunSources.sourceKey, "belambra"),
        ),
      )
    expect(again.sourceRevision).toBe(1)
    // Une piste découverte par ce passage garde la version figée.
    const listed = await recordListedPosting(
      run.id,
      run.claimToken,
      "belambra",
      {
        identityKey: "teamtailor:recrute.belambra.fr:1",
        discoveryUrl: "https://recrute.belambra.fr/jobs/1-serveur",
        listingHash: "h",
      },
    )
    expect(listed).toMatchObject({
      ok: true,
      candidate: { sourceRevision: 1 },
    })
    expect(await initRunSources(run.id, ["inconnue"], run.claimToken)).toEqual({
      ok: false,
      reason: "unknown_source",
    })
  })

  it("une source citée par un dossier ou un passage ne se supprime pas", async () => {
    const run = await insertScanRun(db.$client, {
      status: "running",
      startedAt: new Date(),
    })
    await insertScanCandidate(db.$client, {
      sourceKey: "vvf",
      firstRunId: run.id,
    })
    await expect(
      db.delete(scanSources).where(eq(scanSources.key, "vvf")),
    ).rejects.toThrow()
    await initRunSources(run.id, ["belambra"], run.claimToken)
    await expect(
      db.delete(scanSources).where(eq(scanSources.key, "belambra")),
    ).rejects.toThrow()
    await expect(
      db.insert(scanCandidates).values({
        sourceKey: "inconnue",
        identityKey: "x",
        discoveryUrl: "https://hotel.example/x",
        listingHash: "x",
        firstRunId: run.id,
      }),
    ).rejects.toThrow()
    // Une source sans historique se supprime, avec ses versions, son journal et ses hôtes.
    await db.delete(scanSources).where(eq(scanSources.key, "sandaya"))
    expect(
      await db
        .select()
        .from(scanSourceHosts)
        .where(eq(scanSourceHosts.sourceKey, "sandaya")),
    ).toEqual([])
  })

  it("un hôte officiel appartient à une seule source", async () => {
    await expect(
      db
        .insert(scanSourceHosts)
        .values({ host: "recrute.belambra.fr", sourceKey: "vvf" }),
    ).rejects.toThrow()
    await expect(
      db
        .insert(scanSourceHosts)
        .values({ host: "Recrute.exemple.fr:443", sourceKey: "vvf" }),
    ).rejects.toThrow()
  })

  // Chaque contrainte isolée sur une copie valide de VVF (brouillon) ou de France Travail.
  const vvf = { key: "vvf" }
  it.each<[string, string, Partial<typeof scanSources.$inferInsert>]>([
    ["scan_sources_key", "france-travail", { key: "Clé invalide" }],
    [
      "scan_sources_discovery",
      "france-travail",
      { employerName: "France Travail" },
    ],
    ["scan_sources_siren", vvf.key, { employerSiren: "12345678A" }],
    ["scan_sources_ready", vvf.key, { status: "ready" }],
    ["scan_sources_switches", vvf.key, { enabled: true }],
    ["scan_sources_daily", "france-travail", { dailyEnabled: true }],
    ["scan_sources_rejected", vvf.key, { status: "rejected" }],
    ["scan_sources_archived", vvf.key, { archivedAt: new Date() }],
    ["scan_sources_suspended", vvf.key, { suspendedAt: new Date() }],
    ["scan_sources_reuse", vvf.key, { reuseDecision: "accepted" }],
    ["scan_sources_counters", vvf.key, { priority: -1 }],
    ["scan_sources_texts", vvf.key, { label: "   " }],
  ])("%s refuse sa ligne invalide", async (constraint, key, change) => {
    await expect(
      db.update(scanSources).set(change).where(eq(scanSources.key, key)),
    ).rejects.toMatchObject({ cause: { constraint } })
  })
})

describe("effets du statut", () => {
  let fixture: PublicationFixture
  beforeEach(async () => {
    fixture = await createPublicationFixture()
  })

  it("source écartée : publication bloquée par source_withdrawn", async () => {
    await db
      .update(scanSources)
      .set({
        status: "rejected",
        rejectionReason: "Autorisation retirée",
        enabled: false,
        dailyEnabled: false,
        autoPublish: false,
      })
      .where(eq(scanSources.key, "belambra"))
    expect(await publishCandidate(fixture.request)).toMatchObject({
      ok: false,
      reason: "blocked",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "source_withdrawn" }),
      ]),
    })
    await fixture.cleanup()
  })

  it("source archivée : toujours publiable par l'admin, plus lue par les passages", async () => {
    await db
      .update(scanSources)
      .set({
        status: "archived",
        archivedAt: new Date(),
        enabled: false,
        dailyEnabled: false,
        autoPublish: false,
      })
      .where(eq(scanSources.key, "belambra"))
    expect(await listRunnableSources("bootstrap")).not.toContainEqual(
      expect.objectContaining({ key: "belambra" }),
    )
    expect(
      (await listScanSources()).some((source) => source.key === "belambra"),
    ).toBe(false)
    expect(await publishCandidate(fixture.request)).toMatchObject({
      ok: true,
      created: true,
    })
    await fixture.cleanup()
  })
})

describe("lectures", () => {
  it("seules les sources prêtes, activées et disponibles sont lues, par priorité", async () => {
    expect(await listRunnableSources("bootstrap")).toEqual([])
    await enableScanSource(db.$client, "france-travail")
    await enableScanSource(db.$client, "fixture", { daily: true })
    expect(await listRunnableSources("bootstrap")).toEqual([
      { key: "france-travail", revision: 1 },
      // Connecteur de fixtures indisponible sans SCAN_TEST_SOURCE_URL.
    ])
    expect(await listRunnableSources("daily")).toEqual([])
  })

  it("l'écran reçoit statut, testabilité et raisons des interrupteurs", async () => {
    const summaries = await listScanSources()
    expect(summaries.map((source) => source.key)).toEqual([
      "france-travail",
      "fixture",
      "belambra",
      "vvf",
      "ms-vacances",
      "accor-smartrecruiters",
      "pierre-et-vacances",
      "sandaya",
    ])
    const byKey = Object.fromEntries(
      summaries.map((source) => [source.key, source]),
    )
    expect(byKey["france-travail"]).toMatchObject({
      status: "ready",
      testable: true,
      switchBlockers: {
        enabled: null,
        dailyEnabled: expect.stringContaining("justification"),
        autoPublish: expect.stringContaining("découverte"),
      },
    })
    expect(byKey.belambra).toMatchObject({
      status: "draft",
      testable: true,
      complete: true,
      switchBlockers: { enabled: expect.stringContaining("À qualifier") },
    })
    expect(byKey.sandaya).toMatchObject({
      status: "rejected",
      testable: false,
      complete: false,
    })
    expect(byKey.fixture).toMatchObject({
      testable: false,
      switchBlockers: { enabled: expect.stringContaining("indisponible") },
    })
  })
})
