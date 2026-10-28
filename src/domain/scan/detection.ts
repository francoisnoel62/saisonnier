import { isBlockedHost } from "@/domain/blocked-domains"

import { parseFranceTravailSearchUrl } from "./france-travail-search"
import { knownPlatformFor, type KnownPlatform } from "./known-platforms"
import { suggestUrlPattern } from "./url-pattern"
import type { ScanAdapterKind, ScanSourceKind } from "./vocabulary"

// Détection du connecteur d'une page de départ (§8.2). Pure : les signaux viennent d'une lecture
// de la page (et du flux qu'elle annonce) ; aucun contenu n'est conservé hors de ces signaux.
// Le rapport n'affirme rien sans signal : « non détecté » plutôt qu'une supposition.
export type DetectionSignals = {
  finalUrl: string
  contentType: string
  feedLinks: string[]
  generator: string | null
  assetHosts: string[]
  scriptCount: number
  // Racine d'application vide (#root, #__next, app-root) ou <noscript> qui réclame JavaScript.
  javascriptMarkers: string[]
  jobPosting: "valid" | "invalid_json" | "absent"
  links: string[]
  textLength: number
  rssItems: number
  rssNamespaces: string[]
  // Lien « page suivante » (rel=next) de la liste.
  nextLink: string | null
}
export type DetectionProposal = {
  adapter: ScanAdapterKind | null
  kind: ScanSourceKind
  label: string
  params?: Record<string, unknown>
  evidence: string[]
}
export type DetectionResult = {
  url: string
  host: string
  proposals: DetectionProposal[]
  knownPlatform: KnownPlatform | null
  blockedDomain: boolean
  javascriptShell: boolean
  notes: string[]
}
export type DetectionContext = {
  blockedDomains: readonly string[]
  testSourceUrl?: string
}

function origin(url: URL) {
  return url.origin
}
function sameHost(links: readonly string[], host: string) {
  return links.filter((link) => {
    try {
      return new URL(link).hostname === host
    } catch {
      return false
    }
  })
}

// Plateformes à ne jamais lire depuis l'assistant : aucun accès de collecte autorisé.
export const unreadPlatforms = ["indeed", "linkedin"] as const
export function shouldSkipRead(url: string) {
  try {
    const platform = knownPlatformFor(new URL(url).hostname)
    return (
      !!platform && (unreadPlatforms as readonly string[]).includes(platform.id)
    )
  } catch {
    return false
  }
}

// Rapport sans lecture : plateforme connue et domaine exclu seulement.
export function detectWithoutReading(
  value: string,
  context: DetectionContext,
): DetectionResult {
  const url = new URL(value)
  const knownPlatform = knownPlatformFor(url.hostname)
  const blockedDomain = isBlockedHost(url.hostname, context.blockedDomains)
  return {
    url: url.href,
    host: url.hostname,
    proposals: blockedDomain
      ? [
          {
            adapter: null,
            kind: "discovery",
            label: "Job-board : découverte seulement",
            evidence: ["Hôte couvert par un domaine exclu."],
          },
        ]
      : [],
    knownPlatform,
    blockedDomain,
    javascriptShell: false,
    notes: [
      "Site non lu : aucun accès de collecte autorisé n'est documenté pour cette plateforme.",
    ],
  }
}

export function detectSource(
  signals: DetectionSignals,
  context: DetectionContext,
): DetectionResult {
  const url = new URL(signals.finalUrl)
  const host = url.hostname
  const links = sameHost(signals.links, host)
  const proposals: DetectionProposal[] = []
  const notes: string[] = []
  const knownPlatform = knownPlatformFor(host)
  const blockedDomain = isBlockedHost(host, context.blockedDomains)

  // Serveur de fixtures local (tests seulement).
  if (
    context.testSourceUrl &&
    url.origin === new URL(context.testSourceUrl).origin
  ) {
    const postings = links.filter((link) =>
      /\/jobs\/\d+(?:-[^/?#]+)?$/.test(new URL(link).pathname),
    )
    if (postings.length)
      proposals.push({
        adapter: "fixture",
        kind: "employer",
        label: "Fixtures locales",
        params: { origin: url.origin },
        evidence: [
          `${postings.length} liens /jobs/<id> sur l'origine de test.`,
        ],
      })
  }

  const teamtailor: string[] = []
  if (
    signals.feedLinks.some((feed) => {
      try {
        const target = new URL(feed)
        return target.hostname === host && target.pathname === "/jobs.rss"
      } catch {
        return false
      }
    })
  )
    teamtailor.push("Flux /jobs.rss annoncé par la page.")
  if (signals.rssNamespaces.includes("tt"))
    teamtailor.push("Flux RSS à l'espace de noms tt: de Teamtailor.")
  const teamtailorLinks = links.filter((link) =>
    /^\/jobs\/\d+-[^/?#]+\/?$/.test(new URL(link).pathname),
  )
  if (teamtailorLinks.length)
    teamtailor.push(
      `${teamtailorLinks.length} lien${teamtailorLinks.length > 1 ? "s" : ""} /jobs/<id>-<intitulé>.`,
    )
  if (/teamtailor/i.test(signals.generator ?? ""))
    teamtailor.push(`Générateur déclaré : ${signals.generator}.`)
  if (
    signals.assetHosts.some((asset) =>
      /(^|\.)teamtailor(-cdn)?\.com$/.test(asset),
    )
  )
    teamtailor.push("Scripts ou styles servis par Teamtailor.")
  if (teamtailor.length && url.protocol === "https:")
    proposals.push({
      adapter: "teamtailor",
      kind: "employer",
      label: "Portail Teamtailor",
      params: { portalUrl: origin(url) },
      evidence: teamtailor,
    })

  const factorial: string[] = []
  if (/(^|\.)factorial\.fr$/.test(host)) factorial.push("Hôte *.factorial.fr.")
  const factorialLinks = links.filter((link) =>
    /^\/job_posting\/[^/?#]+-\d+\/?$/.test(new URL(link).pathname),
  )
  if (factorialLinks.length)
    factorial.push(
      `${factorialLinks.length} lien${factorialLinks.length > 1 ? "s" : ""} /job_posting/<intitulé>-<id>.`,
    )
  if (factorial.length && url.protocol === "https:")
    proposals.push({
      adapter: "factorial",
      kind: "employer",
      label: "Portail Factorial",
      params: { portalUrl: origin(url) },
      evidence: factorial,
    })

  if (
    host === "candidat.francetravail.fr" &&
    url.pathname === "/offres/recherche"
  ) {
    const search = parseFranceTravailSearchUrl(url.href)
    proposals.push({
      adapter: "france-travail",
      kind: "discovery",
      label: "Recherche France Travail",
      ...(search ? { params: { searchUrls: [url.href] } } : {}),
      evidence: [
        "Recherche publique de candidat.francetravail.fr.",
        ...(search
          ? []
          : ["Paramètres inconnus : la recherche sera à reconstruire."]),
      ],
    })
  }

  // Liens réguliers sans format connu : connecteur générique (page carrière), motif proposé
  // avec le nombre de liens reconnus et des exemples, à accepter par l'admin.
  const suggestion = proposals.length ? null : suggestUrlPattern(links)
  if (suggestion)
    proposals.push({
      adapter: "career-page",
      kind: "employer",
      label: "Page carrière",
      params: {
        listUrl: url.href,
        postingPattern: suggestion.pattern,
        pagination: { kind: signals.nextLink ? "next" : "none" },
        extraHosts: [],
        requireJsonLd: false,
      },
      evidence: [
        `Motif proposé : ${suggestion.pattern} (${suggestion.matched} liens reconnus).`,
        `Exemples : ${suggestion.examples.join(", ")}.`,
        ...(signals.jobPosting === "valid"
          ? ["JSON-LD JobPosting présent sur la page."]
          : []),
        ...(signals.nextLink ? ["Lien « page suivante » détecté."] : []),
      ],
    })
  else if (signals.jobPosting !== "absent" && !proposals.length)
    notes.push(
      signals.jobPosting === "valid"
        ? "JSON-LD JobPosting présent, mais aucun lien régulier vers des fiches."
        : "JSON-LD JobPosting présent mais invalide.",
    )

  if (blockedDomain) {
    notes.push(
      "Hôte couvert par un domaine exclu : un job-board n'est qu'une découverte (jamais d'employeur, jamais de publication automatique).",
    )
    for (const proposal of proposals) proposal.kind = "discovery"
    if (!proposals.length)
      proposals.push({
        adapter: null,
        kind: "discovery",
        label: "Job-board : découverte seulement",
        evidence: ["Hôte couvert par un domaine exclu."],
      })
  }

  const javascriptShell =
    !proposals.some((proposal) => proposal.adapter) &&
    signals.jobPosting === "absent" &&
    links.length < 3 &&
    signals.scriptCount > 0 &&
    (signals.javascriptMarkers.length > 0 || signals.textLength < 300)
  if (javascriptShell)
    notes.push(
      "Liste construite par JavaScript : aucun connecteur sans navigateur (V4). Enregistrez la source comme « connecteur à développer » ou écartez-la.",
    )
  if (!proposals.length && !javascriptShell && signals.jobPosting === "absent")
    notes.push("Non détecté : aucun signal d'un format connu.")
  return {
    url: url.href,
    host,
    proposals,
    knownPlatform,
    blockedDomain,
    javascriptShell,
    notes,
  }
}

// Domaine à exclure pour un hôte de découverte : le domaine enregistré (deux derniers
// libellés), « www. » retiré.
export function domainToExclude(host: string) {
  const labels = host
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")
  return labels.slice(-2).join(".")
}
