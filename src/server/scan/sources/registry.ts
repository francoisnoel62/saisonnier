import "server-only"

import type {
  ScanSourceDefinition,
  ScanSourceSummary,
} from "@/domain/scan/source"
import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import { env } from "@/lib/env"

const checkedAt = "2026-10-23"

export function buildScanSourceDefinitions(
  testSourceUrl?: string,
): Record<string, ScanSourceDefinition> {
  const sources: Record<string, ScanSourceDefinition> = {
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

export const scanSourceDefinitions = buildScanSourceDefinitions(
  env.SCAN_TEST_SOURCE_URL,
)

// Ce que l'écran admin montre d'une source, par priorité ; la date est la plus récente
// des vérifications documentées (rattachement, conditions de reprise).
export function scanSourceSummaries(
  sources: Record<string, ScanSourceDefinition> = scanSourceDefinitions,
): ScanSourceSummary[] {
  return Object.values(sources)
    .sort((a, b) => a.priority - b.priority)
    .map(
      ({ key, label, kind, role, officialHosts, affiliationProof, reuse }) => ({
        key,
        label,
        kind,
        role,
        officialHosts,
        checkedAt: [affiliationProof.checkedAt, reuse.checkedAt].sort().at(-1)!,
      }),
    )
}
