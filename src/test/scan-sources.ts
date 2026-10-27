import { readFileSync } from "node:fs"
import { join } from "node:path"
import { and, eq, max } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import type { Pool, PoolClient } from "pg"

import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import {
  canonicalJson,
  type ScanSourceDefinition,
  type ScanSourceSnapshot,
} from "@/domain/scan/source"
import {
  scanSourceEvents,
  scanSourceRevisions,
  scanSources,
} from "@/lib/db/schema/scan"
import { sourceConfigHash } from "@/server/scan/sources/config-hash"

// Registre en code au commit ae31948 (plans scan 01 à 08), devenu une donnée figée des tests.
// Le test d'or (registry.int.test.ts) vérifie que la migration 0018 le reproduit à l'identique.
export type LegacyScanSourceDefinition = Omit<
  ScanSourceDefinition,
  "revision" | "adapterParams"
>

const checkedAt = "2026-10-23"

export function legacyScanSourceDefinitions(
  testSourceUrl?: string,
): Record<string, LegacyScanSourceDefinition> {
  const sources: Record<string, LegacyScanSourceDefinition> = {
    "france-travail": {
      key: "france-travail",
      label: "France Travail",
      kind: "discovery",
      employer: null,
      employerWebsite: null,
      adapter: "france-travail",
      listUrls: [franceTravailSearchUrl],
      postingUrlPattern:
        "^https://candidat\\.francetravail\\.fr/offres/recherche/detail/[A-Z0-9]+/?$",
      officialHosts: ["candidat.francetravail.fr"],
      affiliationProof: {
        url: "https://www.francetravail.fr/informations/informations-legales-et-conditio/conditions-generales-dutilisatio.html",
        note: "Source de découverte France Travail choisie par le fondateur. Les CGU du service officiel décrivent la consultation et la diffusion des offres ; France Travail n'est pas l'employeur des recrutements.",
        checkedAt,
      },
      reuse: {
        url: "https://www.francetravail.fr/informations/informations-legales-et-conditio/conditions-generales-dutilisatio.html",
        robotsExcerpt:
          "User-agent: * ; les restrictions de /robots.txt ne visent ni /offres/recherche ni /offres/recherche/detail/. Lecture autorisée le 23/10/2026.",
        note: "Liste HTML publique ; détail JSON public du composant officiel sur /api-descriptifoffre/offre/<id>, sans clé. Ce service est distinct de l'API partenaire restreinte. Les CGU décrivent une licence de réutilisation via partenaires API, sans établir ici une autorisation de republication. La source officielle employeur reste à retrouver avant publication.",
        checkedAt,
      },
      role: "primary",
      priority: 0,
      limits: {},
      placeAliases: {},
    },
    belambra: {
      key: "belambra",
      label: "Belambra",
      kind: "employer",
      employer: { name: "Belambra Clubs", siren: "322706136" },
      adapter: "teamtailor",
      listUrls: ["https://recrute.belambra.fr/jobs.rss"],
      postingUrlPattern:
        "^https://recrute\\.belambra\\.fr/jobs/[0-9]+-[^/?#]+/?$",
      officialHosts: ["recrute.belambra.fr"],
      employerWebsite: "https://www.belambra.fr/",
      affiliationProof: {
        url: "https://www.belambra.fr/faq-foire-aux-questions",
        note: "La FAQ officielle renvoie les candidats vers recrute.belambra.fr.",
        checkedAt,
      },
      reuse: {
        url: "https://www.belambra.fr/mentions-legales",
        robotsExcerpt:
          "User-Agent: * ; Disallow: /app/, /messages/, /messenger/, /facebook/tab/, /jobs/internal/ ; aucun Crawl-delay. /jobs.rss et les fiches publiques autorisés le 23/10/2026.",
        note: "Les mentions du site principal soumettent la reproduction à autorisation écrite préalable. Portée sur le portail ATS et autorisation de reprise à valider par le fondateur avant activation.",
        checkedAt,
      },
      role: "reserve",
      priority: 10,
      limits: {},
      placeAliases: {},
    },
    vvf: {
      key: "vvf",
      label: "VVF",
      kind: "employer",
      employer: { name: "VVF", siren: "775634132" },
      adapter: "factorial",
      listUrls: ["https://vvfrecrute.factorial.fr/"],
      postingUrlPattern:
        "^https://vvfrecrute\\.factorial\\.fr/job_posting/[^/?#]+-[0-9]+/?$",
      officialHosts: ["vvfrecrute.factorial.fr"],
      employerWebsite: "https://www.vvf.fr/",
      affiliationProof: {
        url: "https://www.vvf.fr/article/vvf-recrutement",
        note: "La page officielle renvoie « Voir les offres » vers vvfrecrute.factorial.fr et distingue la candidature spontanée /apply.",
        checkedAt,
      },
      reuse: {
        url: "https://www.vvf.fr/article/conditions-generales-utilisation-site-internet",
        robotsExcerpt:
          "User-agent: *\nAllow: /\nAucun Crawl-delay le 23/10/2026.",
        note: "Les CGU du site principal interdisent la reproduction hors usage privé et non commercial. Portée sur Factorial et autorisation de reprise à valider par le fondateur avant activation.",
        checkedAt,
      },
      role: "reserve",
      priority: 20,
      limits: {},
      // Station de la commune des Adrets (geo.api.gouv.fr, vérifié le 23/10/2026).
      placeAliases: {
        "PRAPOUTEL LES SEPT LAUX": {
          inseeCode: "38002",
          name: "Les Adrets",
          departmentCode: "38",
        },
      },
    },
    "ms-vacances": {
      key: "ms-vacances",
      label: "MS Vacances",
      kind: "employer",
      employer: { name: "MS Vacances" },
      adapter: "teamtailor",
      listUrls: ["https://emploi.ms-vacances.com/jobs.rss"],
      postingUrlPattern:
        "^https://emploi\\.ms-vacances\\.com/jobs/[0-9]+-[^/?#]+/?$",
      officialHosts: ["emploi.ms-vacances.com"],
      employerWebsite: "https://www.ms-vacances.com/",
      affiliationProof: {
        url: "https://www.ms-vacances.com/",
        note: "Le pied de page officiel, rubrique Entre vous & nous, renvoie Offres d'emploi vers emploi.ms-vacances.com.",
        checkedAt,
      },
      reuse: {
        url: "https://www.ms-vacances.com/mentions-legales/",
        robotsExcerpt:
          "User-Agent: * ; Disallow: /app/, /messages/, /messenger/, /facebook/tab/, /jobs/internal/ ; aucun Crawl-delay. Flux et fiches publiques autorisés le 23/10/2026.",
        note: "Page de mentions actuellement sans contenu exploitable ; politique du portail /data-privacy disponible. Aucune autorisation de reprise établie, validation du fondateur attendue avant activation.",
        checkedAt,
      },
      role: "reserve",
      priority: 30,
      limits: {},
      placeAliases: {},
    },
  }
  if (testSourceUrl) {
    const url = new URL(testSourceUrl)
    sources.fixture = {
      key: "fixture",
      label: "Fixtures locales",
      kind: "employer",
      employer: { name: "Employeur de test" },
      adapter: "fixture",
      listUrls: [url.href],
      postingUrlPattern: `^${url.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/jobs/[0-9]+(?:-[^/?#]+)?$`,
      officialHosts: [url.hostname],
      employerWebsite: url.origin,
      affiliationProof: {
        url: url.href,
        note: "Serveur explicitement autorisé pour les tests locaux.",
        checkedAt,
      },
      reuse: {
        url: url.href,
        note: "Fixtures anonymisées du dépôt.",
        robotsExcerpt: "Fourni par le serveur de test.",
        checkedAt,
      },
      role: "reserve",
      priority: 0,
      limits: {},
      placeAliases: {
        Chamonix: {
          name: "Chamonix",
          inseeCode: "74056",
          departmentCode: "74",
        },
      },
    }
  }
  return sources
}

// Paramètres dont chaque connecteur déduit listes, motif et hôtes (adapter-catalog.ts).
export const legacyAdapterParams: Record<string, Record<string, unknown>> = {
  "france-travail": { searchUrls: [franceTravailSearchUrl] },
  belambra: { portalUrl: "https://recrute.belambra.fr" },
  vvf: { portalUrl: "https://vvfrecrute.factorial.fr" },
  "ms-vacances": { portalUrl: "https://emploi.ms-vacances.com" },
}

// Définitions complètes (version 1) lues par les tests des adaptateurs, de la sonde et de
// l'échantillon.
export function testScanSourceDefinitions(
  testSourceUrl?: string,
): Record<string, ScanSourceDefinition> {
  return Object.fromEntries(
    Object.entries(legacyScanSourceDefinitions(testSourceUrl)).map(
      ([key, source]) => [
        key,
        {
          ...source,
          revision: 1,
          adapterParams:
            key === "fixture"
              ? { origin: new URL(testSourceUrl!).origin }
              : legacyAdapterParams[key],
        } as ScanSourceDefinition,
      ],
    ),
  )
}

// Instantané d'une version : la définition sans l'état de la ligne.
export function toSnapshot(
  definition: ScanSourceDefinition,
): ScanSourceSnapshot {
  const snapshot: Partial<ScanSourceDefinition> = { ...definition }
  delete snapshot.key
  delete snapshot.revision
  delete snapshot.role
  delete snapshot.priority
  return snapshot as ScanSourceSnapshot
}

export const fixtureSourceKey = "fixture"
export function fixtureSourceSnapshot(testSourceUrl: string) {
  return toSnapshot(testScanSourceDefinitions(testSourceUrl).fixture)
}

// Migration de reprise des sources, rejouable (tout y est conditionnel).
export function sourceSeedStatements() {
  return readFileSync(
    join(process.cwd(), "drizzle", "0018_scan_source_seed.sql"),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}
export async function replaySourceSeed(client: Pool | PoolClient) {
  for (const statement of sourceSeedStatements()) await client.query(statement)
}

// État de la source de fixtures au début de chaque test : prête, reprise acceptée, désactivée.
export const fixtureSourceState = {
  status: "ready",
  role: "reserve",
  // Après France Travail (priorité 0), avant les réserves migrées.
  priority: 5,
  reuseDecision: "accepted",
  reuseDecisionNote: "Fixtures anonymisées du dépôt, réservées aux tests.",
  scheduledAccessBasis: null,
  enabled: false,
  dailyEnabled: false,
  autoPublish: false,
  suspendedAt: null,
  suspensionReason: null,
  rejectionReason: null,
  archivedAt: null,
} as const

// Graines des tests : rejoue 0018, puis insère ou remet en état la source `fixture` sur
// l'origine de test (nouvelle version si sa configuration a changé, par exemple une source
// de substitution archivée ou un autre port).
export async function seedScanSources(
  client: Pool | PoolClient,
  { testSourceUrl }: { testSourceUrl: string },
) {
  await replaySourceSeed(client)
  const snapshot = fixtureSourceSnapshot(testSourceUrl)
  const configHash = sourceConfigHash(snapshot)
  const identity = {
    label: snapshot.label,
    kind: snapshot.kind,
    adapter: snapshot.adapter,
    employerName: snapshot.employer?.name ?? null,
    employerSiren: snapshot.employer?.siren ?? null,
    employerWebsite: snapshot.employerWebsite,
  }
  await drizzle({ client, casing: "snake_case" }).transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(scanSources)
      .where(eq(scanSources.key, fixtureSourceKey))
      .for("update")
    const decidedAt = new Date()
    if (!row) {
      await tx.insert(scanSources).values({
        key: fixtureSourceKey,
        ...identity,
        ...fixtureSourceState,
        revision: 1,
        reuseDecidedAt: decidedAt,
      })
      await tx.insert(scanSourceRevisions).values({
        sourceKey: fixtureSourceKey,
        revision: 1,
        definition: snapshot,
        complete: true,
        configHash,
      })
      await tx.insert(scanSourceEvents).values({
        sourceKey: fixtureSourceKey,
        kind: "imported",
        revision: 1,
        details: { references: ["src/test/scan-sources.ts"] },
      })
      return
    }
    const [current] = await tx
      .select()
      .from(scanSourceRevisions)
      .where(
        and(
          eq(scanSourceRevisions.sourceKey, fixtureSourceKey),
          eq(scanSourceRevisions.revision, row.revision),
        ),
      )
    let revision = row.revision
    if (
      !current ||
      current.configHash !== configHash ||
      canonicalJson(current.definition) !== canonicalJson(snapshot)
    ) {
      const [{ last }] = await tx
        .select({ last: max(scanSourceRevisions.revision) })
        .from(scanSourceRevisions)
        .where(eq(scanSourceRevisions.sourceKey, fixtureSourceKey))
      revision = (last ?? 0) + 1
      await tx.insert(scanSourceRevisions).values({
        sourceKey: fixtureSourceKey,
        revision,
        definition: snapshot,
        complete: true,
        configHash,
        changedFields: ["definition"],
        note: "Origine de test des graines.",
      })
    }
    await tx
      .update(scanSources)
      .set({
        ...identity,
        ...fixtureSourceState,
        revision,
        reuseDecidedAt: row.reuseDecidedAt ?? decidedAt,
        version: row.version + 1,
      })
      .where(eq(scanSources.key, fixtureSourceKey))
  })
}
