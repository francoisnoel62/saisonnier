import { z } from "zod"

import { compileUrlPattern, parseUrlPattern } from "./url-pattern"
import { isLocalTestOrigin } from "./url-safety"
import {
  scanAdapterLabels,
  type ScanAdapterKind,
  type ScanSourceKind,
} from "./vocabulary"

// D1 : le code connaît les formats (connecteurs), la base connaît les sources. Chaque connecteur
// déduit de ses paramètres les listes lues, le motif des fiches et les hôtes officiels : l'admin
// ne saisit jamais d'expression régulière (D8).
export type DerivedSourceConfig = {
  listUrls: string[]
  postingUrlPattern: string
  officialHosts: string[]
}
export type AdapterAvailability = "available" | "test_only" | "unavailable"
export type AdapterDescriptor<Params> = {
  kind: ScanAdapterKind
  label: string
  // Version d'extracteur annoncée à l'écran ; égale à `extractorVersion` de l'adaptateur.
  version: string | null
  sourceKinds: readonly ScanSourceKind[]
  paramsSchema: z.ZodType<Params>
  derive: ((params: Params) => DerivedSourceConfig) | null
  help: string
  availability: AdapterAvailability
  unavailableReason?: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// URL d'un portail : https, sans identifiants ni port, réduite à son origine.
function portalOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null
  } catch {
    return null
  }
}
const portalUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => portalOrigin(value) !== null, {
    message:
      "Indiquez l’adresse du portail, en https, sans chemin (ex. https://recrute.exemple.fr).",
  })

export const franceTravailOrigin = "https://candidat.francetravail.fr"
export function isFranceTravailSearchUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.origin === franceTravailOrigin &&
      url.pathname === "/offres/recherche" &&
      !url.hash &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
// Plusieurs recherches dans une même source (D7 : un hôte, une source).
export const maxFranceTravailSearches = 5

export type TeamtailorParams = { portalUrl: string }
export type FactorialParams = { portalUrl: string }
export type FranceTravailParams = { searchUrls: string[] }
export type FixtureParams = { origin: string }
export type SmartRecruitersParams = Record<string, never>
export const careerPagePaginations = ["none", "next", "param"] as const
export type CareerPageParams = {
  listUrl: string
  postingPattern: string
  pagination:
    { kind: "none" } | { kind: "next" } | { kind: "param"; name: string }
  extraHosts: string[]
  requireJsonLd: boolean
}
// Liste d'une page carrière : https sans identifiants ni port, ou l'origine locale de test.
function listUrlOk(value: string) {
  try {
    const url = new URL(value)
    return (
      !url.username &&
      !url.password &&
      ((url.protocol === "https:" && !url.port) ||
        isLocalTestOrigin(url.origin))
    )
  } catch {
    return false
  }
}

const teamtailor: AdapterDescriptor<TeamtailorParams> = {
  kind: "teamtailor",
  label: scanAdapterLabels.teamtailor,
  version: "teamtailor@2",
  sourceKinds: ["employer"],
  paramsSchema: z.object({ portalUrl: portalUrlSchema }).strict(),
  derive: ({ portalUrl }) => {
    const origin = portalOrigin(portalUrl)!
    return {
      listUrls: [`${origin}/jobs.rss`],
      postingUrlPattern: `^${escapeRegExp(origin)}/jobs/[0-9]+-[^/?#]+/?$`,
      officialHosts: [new URL(origin).hostname],
    }
  },
  help: "Adresse du portail carrière Teamtailor, par exemple https://recrute.exemple.fr : le flux /jobs.rss et les fiches /jobs/<id>-<intitulé> en sont déduits.",
  availability: "available",
}
const factorial: AdapterDescriptor<FactorialParams> = {
  kind: "factorial",
  label: scanAdapterLabels.factorial,
  version: "factorial@1",
  sourceKinds: ["employer"],
  paramsSchema: z.object({ portalUrl: portalUrlSchema }).strict(),
  derive: ({ portalUrl }) => {
    const origin = portalOrigin(portalUrl)!
    return {
      listUrls: [`${origin}/`],
      postingUrlPattern: `^${escapeRegExp(origin)}/job_posting/[^/?#]+-[0-9]+/?$`,
      officialHosts: [new URL(origin).hostname],
    }
  },
  help: "Adresse du portail Factorial, par exemple https://exemple.factorial.fr : la liste est le portail, les fiches /job_posting/<intitulé>-<id> (la candidature spontanée /apply est ignorée).",
  availability: "available",
}
const franceTravail: AdapterDescriptor<FranceTravailParams> = {
  kind: "france-travail",
  label: scanAdapterLabels["france-travail"],
  version: "france-travail@3",
  sourceKinds: ["discovery"],
  paramsSchema: z
    .object({
      searchUrls: z
        .array(
          z.string().max(2048).refine(isFranceTravailSearchUrl, {
            message:
              "Recherche attendue sur https://candidat.francetravail.fr/offres/recherche.",
          }),
        )
        .min(1)
        .max(maxFranceTravailSearches),
    })
    .strict(),
  derive: ({ searchUrls }) => ({
    listUrls: [...searchUrls],
    postingUrlPattern: `^${escapeRegExp(franceTravailOrigin)}/offres/recherche/detail/[A-Z0-9]+/?$`,
    officialHosts: [new URL(franceTravailOrigin).hostname],
  }),
  help: "Recherche publique de candidat.francetravail.fr : la pagination (range) est gérée par le connecteur ; chaque fiche est lue dans le JSON public du composant officiel.",
  availability: "available",
}
const fixture: AdapterDescriptor<FixtureParams> = {
  kind: "fixture",
  label: scanAdapterLabels.fixture,
  version: "fixture@1",
  sourceKinds: ["employer"],
  paramsSchema: z
    .object({
      origin: z.string().refine(isLocalTestOrigin, {
        message: "Origine locale de test attendue (http://localhost:<port>).",
      }),
    })
    .strict(),
  derive: ({ origin }) => {
    const url = new URL(origin)
    return {
      listUrls: [url.href],
      postingUrlPattern: `^${escapeRegExp(url.origin)}/jobs/[0-9]+(?:-[^/?#]+)?$`,
      officialHosts: [url.hostname],
    }
  },
  help: "Serveur de fixtures local, seulement lorsque SCAN_TEST_SOURCE_URL est défini.",
  availability: "test_only",
}
const smartrecruiters: AdapterDescriptor<SmartRecruitersParams> = {
  kind: "smartrecruiters",
  label: scanAdapterLabels.smartrecruiters,
  version: null,
  sourceKinds: ["employer"],
  paramsSchema: z.object({}).strict() as z.ZodType<SmartRecruitersParams>,
  derive: null,
  help: "Aucun connecteur : l’API publique est fermée à notre robot.",
  availability: "unavailable",
  unavailableReason:
    "Connecteur indisponible : le robots.txt de l’API SmartRecruiters refuse notre robot (plan scan 01).",
}

const careerPage: AdapterDescriptor<CareerPageParams> = {
  kind: "career-page",
  label: scanAdapterLabels["career-page"],
  version: "career-page@1",
  sourceKinds: ["employer"],
  paramsSchema: z
    .object({
      listUrl: z.string().max(2048).refine(listUrlOk, {
        message: "Adresse https de la liste des offres.",
      }),
      postingPattern: z.string().superRefine((value, context) => {
        const parsed = parseUrlPattern(value)
        if (!parsed.ok)
          context.addIssue({ code: "custom", message: parsed.message })
      }),
      pagination: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("none") }),
        z.object({ kind: z.literal("next") }),
        z.object({
          kind: z.literal("param"),
          name: z.string().regex(/^[A-Za-z0-9_.-]{1,30}$/, {
            message: "Nom du paramètre de page (lettres, chiffres, _ . -).",
          }),
        }),
      ]),
      extraHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).max(5),
      requireJsonLd: z.boolean(),
    })
    .strict()
    .superRefine((params, context) => {
      const parsed = parseUrlPattern(params.postingPattern)
      if (!parsed.ok || !listUrlOk(params.listUrl)) return
      const hosts = [new URL(params.listUrl).hostname, ...params.extraHosts]
      if (!hosts.includes(parsed.pattern.host))
        context.addIssue({
          code: "custom",
          path: ["postingPattern"],
          message:
            "Les fiches doivent être sur l'hôte de la liste ou un hôte supplémentaire déclaré.",
        })
    }),
  derive: ({ listUrl, postingPattern, extraHosts }) => ({
    listUrls: [listUrl],
    postingUrlPattern: compileUrlPattern(postingPattern)!,
    officialHosts: [
      ...new Set([
        new URL(listUrl).hostname,
        ...(() => {
          const parsed = parseUrlPattern(postingPattern)
          return parsed.ok ? [parsed.pattern.host] : []
        })(),
        ...extraHosts,
      ]),
    ],
  }),
  help: "Site carrière rendu côté serveur : adresse de la liste (HTML, plan de site ou flux RSS), motif simplifié des fiches (ex. https://recrute.exemple.fr/offres/{slug}-{id}) et pagination.",
  availability: "available",
}

export const adapterCatalog = {
  teamtailor,
  factorial,
  "france-travail": franceTravail,
  fixture,
  smartrecruiters,
  "career-page": careerPage,
} satisfies Record<ScanAdapterKind, { kind: ScanAdapterKind }>

export function adapterDescriptor(
  kind: ScanAdapterKind,
): AdapterDescriptor<unknown> {
  return adapterCatalog[kind] as AdapterDescriptor<unknown>
}

export function parseAdapterParams(kind: ScanAdapterKind, params: unknown) {
  return adapterDescriptor(kind).paramsSchema.safeParse(params)
}

// Listes, motif et hôtes déduits des paramètres ; null si le connecteur n'en déduit rien ou si
// les paramètres sont invalides.
export function deriveSourceConfig(
  kind: ScanAdapterKind,
  params: unknown,
): DerivedSourceConfig | null {
  const descriptor = adapterDescriptor(kind)
  const parsed = descriptor.paramsSchema.safeParse(params)
  return parsed.success && descriptor.derive
    ? descriptor.derive(parsed.data)
    : null
}

export type AdapterEnvironment = { testSourceUrl?: string }
export function isAdapterAvailable(
  kind: ScanAdapterKind,
  environment: AdapterEnvironment,
) {
  const { availability } = adapterDescriptor(kind)
  return (
    availability === "available" ||
    (availability === "test_only" && !!environment.testSourceUrl)
  )
}
