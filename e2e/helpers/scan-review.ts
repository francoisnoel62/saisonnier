import { randomUUID } from "node:crypto"
import type { Pool } from "pg"

import {
  buildProposal,
  type ScanProposal,
} from "../../src/domain/scan/proposal"
import { normalizeJobTitle } from "../../src/domain/scan/title"
import { observation, posting } from "../../src/domain/scan/rules-fixtures"
import { insertScanCandidate } from "./scan"

export async function insertReviewableCandidate(
  db: Pool,
  runId: string,
  {
    title = `Serveur scan ${randomUUID().slice(0, 8)}`,
    proposalPatch = {},
    suggestion = false,
  }: {
    title?: string
    proposalPatch?: Partial<ScanProposal>
    suggestion?: boolean
  } = {},
) {
  const now = new Date()
  const year = now.getUTCFullYear() + (now.getUTCMonth() >= 11 ? 1 : 0)
  const sourceUrl = `https://recrute.belambra.fr/jobs/${randomUUID().replace(/\D/g, "").slice(0, 10)}-serveur`
  const companyName = `Employeur scan ${randomUUID().slice(0, 8)}`
  const {
    rows: [company],
  } = await db.query<{ id: string }>(
    "insert into companies (legal_name) values ($1) returning id",
    [companyName],
  )
  const extraction = posting({
    title,
    officialUrl: sourceUrl,
    discoveryUrl: sourceUrl,
    collectedAt: now.toISOString(),
    sourceDate: { precision: "instant", at: now.toISOString() },
    usefulText: `Nous recrutons un serveur pour notre établissement de tourisme. Nous proposons un CDD saisonnier pour la saison d’hiver du 15 décembre ${year} au 15 avril ${year + 1}. Le poste est à pourvoir. Vous accueillez les clients et vous assurez le service des repas dans notre restaurant.`,
    observations: [
      observation({ name: companyName }, "company"),
      observation(
        [{ communeName: "Chamonix", departmentCode: "74", country: "France" }],
        "locations",
      ),
      observation("active", "activity"),
    ],
  })
  const proposal = {
    ...buildProposal(extraction, {
      referenceDate: now.toISOString().slice(0, 10),
    }),
    ...proposalPatch,
  }
  const candidate = await insertScanCandidate(db, {
    firstRunId: runId,
    sourceKey: "belambra",
    status: "to_review",
    title,
    proposal,
    pageText: extraction.usefulText,
    observations: extraction.observations,
    officialUrl: sourceUrl,
    discoveryUrl: sourceUrl,
    lastFetchedAt: now,
    firstSeenAt: now,
    sourcePublishedDate: now.toISOString().slice(0, 10),
    sourcePublishedAt: now,
  })
  if (suggestion) {
    const {
      rows: [review],
    } = await db.query<{ id: string }>(
      `insert into scan_reviews (kind, group_key, candidate_id, details) values ('occupation', $1, $2, $3) on conflict (kind, group_key) do update set occurrences = scan_reviews.occurrences + 1, last_seen_at = now() returning id`,
      [
        `occupation:${normalizeJobTitle(title)}`,
        candidate.id,
        JSON.stringify({
          title,
          normalizedLabel: normalizeJobTitle(title),
          context: "Intitulé inconnu de test",
        }),
      ],
    )
    await db.query(
      "update scan_candidates set occupation_review_id = $1 where id = $2",
      [review.id, candidate.id],
    )
  }
  await db.query(
    "update scan_runs set delivered_count = delivered_count + 1, first_delivered_at = coalesce(first_delivered_at, now()) where id = $1",
    [runId],
  )
  return {
    candidate,
    proposal,
    companyId: company.id,
    companyName,
    title,
    sourceUrl,
  }
}

// Dossier à vérifier d'une découverte (France Travail) : employeur proposé, lieu à résoudre,
// URL officielle facultative (lot F du plan scan V2-01).
export async function insertDiscoveryCandidate(
  db: Pool,
  runId: string,
  {
    employer,
    communeName = "Les Menuires",
    officialUrl,
  }: { employer: string; communeName?: string; officialUrl?: string },
) {
  const now = new Date()
  const extraction = posting({
    title: `Serveur découverte ${randomUUID().slice(0, 8)}`,
    officialUrl,
    discoveryUrl: `https://candidat.francetravail.fr/offres/recherche/detail/${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`,
    collectedAt: now.toISOString(),
    observations: [
      observation({ name: employer }, "company"),
      observation([{ communeName, country: "France" }], "locationCandidates"),
    ],
  })
  return insertScanCandidate(db, {
    firstRunId: runId,
    sourceKey: "france-travail",
    status: "to_review",
    title: extraction.title,
    proposal: buildProposal(extraction, {
      referenceDate: now.toISOString().slice(0, 10),
    }),
    officialUrl: officialUrl ?? null,
    discoveryUrl: extraction.discoveryUrl,
    lastFetchedAt: now,
  })
}
