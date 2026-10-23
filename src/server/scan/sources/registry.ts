import "server-only"

import type { ScanSourceDefinition } from "@/domain/scan/source"
import { env } from "@/lib/env"

const checkedAt = "2026-10-23"

export function buildScanSourceDefinitions(
  testSourceUrl?: string,
): Record<string, ScanSourceDefinition> {
  const sources: Record<string, ScanSourceDefinition> = {
    belambra: {
      key: "belambra",
      label: "Belambra",
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
      role: "primary",
      priority: 10,
      limits: {},
      placeAliases: {},
    },
    vvf: {
      key: "vvf",
      label: "VVF",
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
      role: "primary",
      priority: 20,
      limits: {},
      placeAliases: {},
    },
    accor: {
      key: "accor",
      label: "Accor (réserve à qualifier)",
      employer: { name: "Accor" },
      adapter: "smartrecruiters",
      listUrls: [
        "https://api.smartrecruiters.com/v1/companies/Accor/postings?country=fr",
      ],
      postingUrlPattern:
        "^https://api\\.smartrecruiters\\.com/v1/companies/Accor/postings/[^/?#]+$",
      officialHosts: ["api.smartrecruiters.com", "careers.accor.com"],
      employerWebsite: "https://group.accor.com/",
      affiliationProof: {
        url: "https://careers.accor.com/",
        note: "Réserve : rattachement de l'API publique au portail officiel et périmètre loisirs à établir employeur par employeur.",
        checkedAt,
      },
      reuse: {
        url: "https://careers.accor.com/",
        robotsExcerpt: "Non relevé ; source de réserve non qualifiée.",
        note: "Conditions API et portail à examiner avant toute activation. Ni volume ni admissibilité établis.",
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
      placeAliases: {},
    }
  }
  return sources
}

export const scanSourceDefinitions = buildScanSourceDefinitions(
  env.SCAN_TEST_SOURCE_URL,
)
