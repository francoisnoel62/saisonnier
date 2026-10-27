// Plateformes déjà étudiées (§8.2) : la conclusion documentée s'affiche au moment où elle sert.
// N'y figure que ce qu'établissent docs/recherche-sources-scan-sans-ia.md,
// docs/exploration-scan-sans-ia-v1.md, docs/scan/sources-v1.md et le plan scan V2-01.
export type KnownPlatformKind =
  "job_board" | "aggregator" | "ats" | "public_service"
export const knownPlatformKindLabels: Record<KnownPlatformKind, string> = {
  job_board: "Job-board",
  aggregator: "Agrégateur",
  ats: "Logiciel de recrutement (ATS)",
  public_service: "Service public de l'emploi",
}
export type KnownPlatform = {
  id: string
  name: string
  kind: KnownPlatformKind
  hosts: readonly string[]
  conclusion: string
  links: readonly { label: string; url: string }[]
}

const research = {
  label: "Recherche des sources (docs)",
  url: "docs/recherche-sources-scan-sans-ia.md",
}
const exploration = {
  label: "Exploration du scan (docs)",
  url: "docs/exploration-scan-sans-ia-v1.md",
}

export const knownPlatforms: readonly KnownPlatform[] = [
  {
    id: "indeed",
    name: "Indeed",
    kind: "job_board",
    hosts: ["indeed.com", "indeed.fr"],
    conclusion:
      "Aucun accès de collecte autorisé : le Publisher JavaScript Plugin est réservé aux partenaires. À enregistrer « Écartée » ; piste V3 via un moteur de recherche.",
    links: [
      research,
      {
        label: "Intégrations Indeed",
        url: "https://docs.indeed.com/job-postings",
      },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    kind: "job_board",
    hosts: ["linkedin.com"],
    conclusion:
      "Les permissions ouvertes couvrent l'identité et le partage ; les intégrations Talent passent par des programmes partenaires. Aucune recherche générale d'offres : à écarter.",
    links: [
      research,
      {
        label: "Accès aux API LinkedIn",
        url: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access",
      },
    ],
  },
  {
    id: "france-travail",
    name: "France Travail",
    kind: "public_service",
    hosts: ["francetravail.fr"],
    conclusion:
      "Découverte prioritaire (SH17) : recherche publique lue sans compte. Passages quotidiens seulement avec l'API officielle (compte partenaire) ou un avis juridique écrit.",
    links: [
      { label: "Dossier des sources (docs)", url: "docs/scan/sources-v1.md" },
      {
        label: "API Offres d'emploi",
        url: "https://www.data.gouv.fr/dataservices/api-offres-demploi",
      },
    ],
  },
  {
    id: "seasonjobs",
    name: "SeasonJobs",
    kind: "job_board",
    hosts: ["seasonjobs.com"],
    conclusion:
      "Job-board saisonnier, déjà exclu : découverte seulement, après accord écrit ou flux fourni. Brouillon « en attente d'autorisation » d'ici là.",
    links: [
      {
        label: "Plan scan V2-01, §5",
        url: "docs/plans/scan-v2/01-gestion-des-sources.md",
      },
    ],
  },
  {
    id: "easyjobs",
    name: "EasyJobs",
    kind: "aggregator",
    hosts: ["easyjobs.fr"],
    conclusion:
      "Requêtes publiques sans compte, mais description abrégée à 600 caractères et aucune URL externe de candidature : candidat conditionnel, pas un connecteur acquis.",
    links: [
      research,
      { label: "Documentation", url: "https://api.easyjobs.fr/public/docs/" },
    ],
  },
  {
    id: "arbeitnow",
    name: "Arbeitnow",
    kind: "aggregator",
    hosts: ["arbeitnow.com", "arbeitnow.fr"],
    conclusion:
      "API gratuite sans clé, alimentée par des ATS ; déclinaison France existante. Candidat conditionnel soumis à ses obligations d'attribution.",
    links: [
      research,
      {
        label: "Conditions",
        url: "https://www.arbeitnow.fr/terms",
      },
    ],
  },
  {
    id: "jobicy",
    name: "Jobicy",
    kind: "aggregator",
    hosts: ["jobicy.com"],
    conclusion:
      "Offres de télétravail seulement ; liens de candidature qui doivent mener à Jobicy. Hors périmètre saisonnier.",
    links: [
      research,
      { label: "Flux", url: "https://jobicy.com/jobs-rss-feed" },
    ],
  },
  {
    id: "jooble",
    name: "Jooble",
    kind: "aggregator",
    hosts: ["jooble.org"],
    conclusion:
      "500 requêtes gratuites au total par clé ; extrait et lien Jooble seulement. Inadapté à un scan quotidien.",
    links: [
      research,
      {
        label: "Documentation",
        url: "https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation",
      },
    ],
  },
  {
    id: "teamtailor",
    name: "Teamtailor",
    kind: "ats",
    hosts: ["teamtailor.com", "teamtailor-cdn.com"],
    conclusion:
      "Flux jobs.rss documenté (champs et pagination) : connecteur teamtailor disponible pour tout portail de ce format.",
    links: [
      exploration,
      {
        label: "Guide RSS",
        url: "https://support.teamtailor.com/en/articles/11171756-rss-feed-how-to-guide",
      },
    ],
  },
  {
    id: "factorial",
    name: "Factorial",
    kind: "ats",
    hosts: ["factorial.fr", "factorialhr.com"],
    conclusion:
      "Portail HTML lisible sans JavaScript (VVF) : connecteur factorial disponible pour tout portail de ce format.",
    links: [
      { label: "Dossier des sources (docs)", url: "docs/scan/sources-v1.md" },
    ],
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    kind: "ats",
    hosts: ["smartrecruiters.com"],
    conclusion:
      "API documentée, mais robots.txt de l'API refuse tout robot autre que LinkedInBot (23/10/2026) : aucun connecteur.",
    links: [
      { label: "Dossier des sources (docs)", url: "docs/scan/sources-v1.md" },
      {
        label: "API des annonces",
        url: "https://developers.smartrecruiters.com/reference/v1listpostings",
      },
    ],
  },
  {
    id: "recruitee",
    name: "Recruitee",
    kind: "ats",
    hosts: ["recruitee.com"],
    conclusion:
      "Jeton exigé pour l'API carrière à partir du 10/02/2027 ; le flux XML en est exclu et reste à évaluer.",
    links: [
      exploration,
      {
        label: "Authentification",
        url: "https://docs.recruitee.com/reference/authentication-1",
      },
    ],
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    kind: "ats",
    hosts: ["greenhouse.io"],
    conclusion:
      "Job Board API publique en lecture ; hébergement mutualisé par chemin : il faudra `officialScopes` avant un connecteur.",
    links: [research, exploration],
  },
  {
    id: "lever",
    name: "Lever",
    kind: "ats",
    hosts: ["lever.co"],
    conclusion:
      "Postings API publique par site employeur ; hébergement mutualisé par chemin : il faudra `officialScopes` avant un connecteur.",
    links: [research, exploration],
  },
  {
    id: "werecruit",
    name: "WeRecruit",
    kind: "ats",
    hosts: ["werecruit.io", "sandaya.jobs"],
    conclusion:
      "Liste construite par JavaScript (Sandaya, plan scan 01) : aucun connecteur sans navigateur (V4).",
    links: [
      { label: "Dossier des sources (docs)", url: "docs/scan/sources-v1.md" },
    ],
  },
]

export function knownPlatformFor(host: string): KnownPlatform | null {
  const normalized = host.toLowerCase().replace(/\.$/, "")
  return (
    knownPlatforms.find((platform) =>
      platform.hosts.some(
        (candidate) =>
          normalized === candidate || normalized.endsWith(`.${candidate}`),
      ),
    ) ?? null
  )
}
