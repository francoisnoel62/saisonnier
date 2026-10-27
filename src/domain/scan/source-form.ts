import { z } from "zod"

import { isValidSiren } from "@/domain/membership"

import {
  adapterDescriptor,
  deriveSourceConfig,
  maxFranceTravailSearches,
  parseAdapterParams,
} from "./adapter-catalog"
import {
  franceTravailSearchSchema,
  franceTravailSearchUrl,
  parseFranceTravailSearchUrl,
} from "./france-travail-search"
import { scanLimits } from "./limits"
import {
  canonicalJson,
  scanHostPattern,
  type ScanSourceDraftSnapshot,
} from "./source"
import { isLocalTestOrigin } from "./url-safety"
import {
  scanAdapterKinds,
  scanSourceKinds,
  type ScanAdapterKind,
  type ScanSourceKind,
} from "./vocabulary"

// Formulaire d'une source (§11.5) : des textes, transformés en instantané de version. Les règles
// reprennent les CHECK de `scan_sources` et le schéma des versions : aucune erreur SQL n'atteint
// l'admin. Un brouillon peut rester incomplet ; seule une version complète est lue.
export type SourceFormValues = {
  label: string
  kind: ScanSourceKind
  employerName: string
  employerSiren: string
  employerWebsite: string
  adapter: ScanAdapterKind | ""
  portalUrl: string
  search: {
    motsCles: string
    domaine: string
    typeContrat: string
    lieux: string
    rayon: string
    emission: string
    offresPartenaires: boolean
    tri: string
  }
  // Recherches France Travail supplémentaires, une adresse par ligne (cinq recherches au plus).
  extraSearchUrls: string
  // Page carrière (connecteur générique, lot D).
  careerPage: {
    listUrl: string
    postingPattern: string
    pagination: "none" | "next" | "param"
    pageParam: string
    extraHosts: string
    requireJsonLd: boolean
  }
  fixtureOrigin: string
  // Connecteur sans déduction (aucun, SmartRecruiters) : hôtes et listes documentés.
  manualHosts: string
  manualListUrls: string
  affiliationUrl: string
  affiliationNote: string
  affiliationCheckedAt: string
  reuseUrl: string
  reuseRobotsExcerpt: string
  reuseNote: string
  reuseCheckedAt: string
  maxListPages: string
  maxPostings: string
  minIntervalMs: string
  placeAliases: {
    name: string
    inseeCode: string
    communeName: string
    departmentCode: string
  }[]
  // Motif de la modification.
  note: string
}
export type SourceFormContext = {
  today: string
  // Origine locale de test acceptée pour le connecteur de fixtures (hors production).
  testSourceUrl?: string
}
export const sourceTextLimits = {
  label: 80,
  employerName: 200,
  note: 2000,
  proofNote: 2000,
  robotsExcerpt: 2000,
} as const

export function emptySourceFormValues(
  kind: ScanSourceKind = "employer",
): SourceFormValues {
  return {
    label: "",
    kind,
    employerName: "",
    employerSiren: "",
    employerWebsite: "",
    adapter: "",
    portalUrl: "",
    search: {
      motsCles: "",
      domaine: "",
      typeContrat: "",
      lieux: "",
      rayon: "",
      emission: "",
      offresPartenaires: false,
      tri: "",
    },
    extraSearchUrls: "",
    careerPage: {
      listUrl: "",
      postingPattern: "",
      pagination: "none",
      pageParam: "page",
      extraHosts: "",
      requireJsonLd: false,
    },
    fixtureOrigin: "",
    manualHosts: "",
    manualListUrls: "",
    affiliationUrl: "",
    affiliationNote: "",
    affiliationCheckedAt: "",
    reuseUrl: "",
    reuseRobotsExcerpt: "",
    reuseNote: "",
    reuseCheckedAt: "",
    maxListPages: "",
    maxPostings: "",
    minIntervalMs: "",
    placeAliases: [],
    note: "",
  }
}

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} : ${max} caractères au plus.`)
function httpsUrl(value: string, context: SourceFormContext) {
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (
      context.testSourceUrl &&
      url.protocol === "http:" &&
      url.origin === new URL(context.testSourceUrl).origin
    )
      return url
    return url.protocol === "https:" && !url.port ? url : null
  } catch {
    return null
  }
}
function lines(value: string) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}
// Supprime les clés absentes : un instantané s'écrit comme il se relit (jsonb).
function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T
}
const integerText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        !value || (/^[0-9]+$/.test(value) && +value >= min && +value <= max),
      message,
    )

export function scanSourceFormSchema(context: SourceFormContext) {
  return z
    .object({
      label: text(sourceTextLimits.label, "Libellé").min(
        1,
        "Indiquez le libellé de la source.",
      ),
      kind: z.enum(scanSourceKinds),
      employerName: text(sourceTextLimits.employerName, "Employeur"),
      employerSiren: z.string().trim(),
      employerWebsite: z.string().trim().max(2048),
      adapter: z.enum(["", ...scanAdapterKinds]),
      portalUrl: z.string().trim().max(2048),
      search: z.object({
        motsCles: z.string(),
        domaine: z.string(),
        typeContrat: z.string(),
        lieux: z.string(),
        rayon: z.string(),
        emission: z.string(),
        offresPartenaires: z.boolean(),
        tri: z.string(),
      }),
      extraSearchUrls: z.string().max(10_000),
      careerPage: z.object({
        listUrl: z.string().trim().max(2048),
        postingPattern: z.string().trim().max(300),
        pagination: z.enum(["none", "next", "param"]),
        pageParam: z.string().trim(),
        extraHosts: z.string().max(2000),
        requireJsonLd: z.boolean(),
      }),
      fixtureOrigin: z.string().trim(),
      manualHosts: z.string().max(2000),
      manualListUrls: z.string().max(20_000),
      affiliationUrl: z.string().trim().max(2048),
      affiliationNote: text(sourceTextLimits.proofNote, "Preuve"),
      affiliationCheckedAt: z.string().trim(),
      reuseUrl: z.string().trim().max(2048),
      reuseRobotsExcerpt: text(sourceTextLimits.robotsExcerpt, "robots.txt"),
      reuseNote: text(sourceTextLimits.proofNote, "Conditions"),
      reuseCheckedAt: z.string().trim(),
      maxListPages: integerText(
        1,
        scanLimits.maxListPages,
        `De 1 à ${scanLimits.maxListPages} pages.`,
      ),
      maxPostings: integerText(
        1,
        scanLimits.maxPostings,
        `De 1 à ${scanLimits.maxPostings} fiches.`,
      ),
      minIntervalMs: integerText(
        scanLimits.minIntervalMs,
        60_000,
        `De ${scanLimits.minIntervalMs} à 60 000 ms : un délai ne peut que s'allonger.`,
      ),
      placeAliases: z
        .array(
          z.object({
            name: text(200, "Nom"),
            inseeCode: z.string().trim(),
            communeName: text(200, "Commune"),
            departmentCode: z.string().trim(),
          }),
        )
        .max(200, "200 lieux connus au plus."),
      note: text(sourceTextLimits.note, "Motif"),
    })
    .superRefine((values, issues) => {
      const issue = (path: (string | number)[], message: string) =>
        issues.addIssue({ code: "custom", path, message })
      if (values.kind === "employer") {
        if (values.employerSiren) {
          const siren = values.employerSiren.replace(/\s/g, "")
          if (!isValidSiren(siren))
            issue(["employerSiren"], "SIREN invalide : neuf chiffres attendus.")
        }
        if (
          values.employerWebsite &&
          !httpsUrl(values.employerWebsite, context)
        )
          issue(["employerWebsite"], "Adresse https attendue.")
      }
      if (values.adapter) {
        const descriptor = adapterDescriptor(values.adapter)
        if (!descriptor.sourceKinds.includes(values.kind))
          issue(
            ["adapter"],
            values.kind === "discovery"
              ? "Ce connecteur lit un portail employeur, pas une découverte."
              : "Ce connecteur lit une découverte, pas un portail employeur.",
          )
        if (values.adapter === "teamtailor" || values.adapter === "factorial") {
          const url = httpsUrl(values.portalUrl, context)
          if (!url)
            issue(
              ["portalUrl"],
              "Adresse du portail attendue, en https (ex. https://recrute.exemple.fr).",
            )
        }
        if (values.adapter === "france-travail") {
          const search = franceTravailSearchSchema.safeParse(
            searchInput(values.search),
          )
          if (!search.success)
            for (const problem of search.error.issues)
              issue(["search", ...problem.path.map(String)], problem.message)
          const extra = lines(values.extraSearchUrls)
          for (const url of extra)
            if (!parseFranceTravailSearchUrl(url))
              issue(
                ["extraSearchUrls"],
                `Recherche publique attendue (candidat.francetravail.fr/offres/recherche) : ${url}.`,
              )
          if (extra.length + 1 > maxFranceTravailSearches)
            issue(
              ["extraSearchUrls"],
              `${maxFranceTravailSearches} recherches au plus.`,
            )
        }
        if (values.adapter === "career-page") {
          const parsed = parseAdapterParams(
            "career-page",
            careerPageParams(values.careerPage),
          )
          if (!parsed.success)
            for (const problem of parsed.error.issues) {
              const [field] = problem.path.map(String)
              issue(
                [
                  "careerPage",
                  field === "pagination"
                    ? "pageParam"
                    : field === "extraHosts"
                      ? "extraHosts"
                      : (field ?? "postingPattern"),
                ],
                problem.message,
              )
            }
        }
        if (
          values.adapter === "fixture" &&
          (!isLocalTestOrigin(values.fixtureOrigin) ||
            !context.testSourceUrl ||
            new URL(values.fixtureOrigin).origin !==
              new URL(context.testSourceUrl).origin)
        )
          issue(
            ["fixtureOrigin"],
            "Origine locale de test attendue (SCAN_TEST_SOURCE_URL).",
          )
      }
      for (const host of lines(values.manualHosts))
        if (!scanHostPattern.test(host) || host.length > 253)
          issue(
            ["manualHosts"],
            `Hôte invalide : ${host} (minuscules, sans port ni chemin).`,
          )
      for (const url of lines(values.manualListUrls))
        if (!httpsUrl(url, context))
          issue(["manualListUrls"], `Adresse https attendue : ${url}.`)
      for (const [prefix, fields] of [
        [
          "affiliation",
          [
            values.affiliationUrl,
            values.affiliationNote,
            values.affiliationCheckedAt,
          ],
        ],
        [
          "reuse",
          [
            values.reuseUrl,
            values.reuseRobotsExcerpt,
            values.reuseNote,
            values.reuseCheckedAt,
          ],
        ],
      ] as const) {
        if (!fields.some(Boolean)) continue
        const [url, ...rest] = fields
        if (!httpsUrl(url, context))
          issue([`${prefix}Url`], "Adresse https de la page consultée.")
        const checkedAt = rest.at(-1)!
        if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || checkedAt > context.today)
          issue(
            [`${prefix}CheckedAt`],
            "Date de consultation attendue, au plus aujourd'hui.",
          )
        if (prefix === "affiliation" && !values.affiliationNote)
          issue(["affiliationNote"], "Décrivez la preuve de rattachement.")
        if (prefix === "reuse") {
          if (!values.reuseRobotsExcerpt)
            issue(["reuseRobotsExcerpt"], "Recopiez l'extrait de robots.txt.")
          if (!values.reuseNote)
            issue(["reuseNote"], "Résumez les conditions consultées.")
        }
      }
      const names = new Set<string>()
      values.placeAliases.forEach((alias, index) => {
        const key = alias.name.toLocaleLowerCase("fr")
        if (!alias.name) issue(["placeAliases", index, "name"], "Nom attendu.")
        else if (names.has(key))
          issue(["placeAliases", index, "name"], "Ce nom est déjà déclaré.")
        names.add(key)
        if (!/^(?:\d{2,3}|2[AB])$/.test(alias.departmentCode))
          issue(
            ["placeAliases", index, "departmentCode"],
            "Département attendu.",
          )
        if (
          !/^(?:\d{5}|2[AB]\d{3})$/.test(alias.inseeCode) ||
          !alias.inseeCode.startsWith(alias.departmentCode)
        )
          issue(
            ["placeAliases", index, "inseeCode"],
            "Code INSEE de la commune, préfixé par son département.",
          )
        if (!alias.communeName)
          issue(["placeAliases", index, "communeName"], "Commune attendue.")
      })
    })
    .transform((values) => ({
      snapshot: formValuesToSnapshot(values as SourceFormValues),
      note: values.note || null,
    }))
}

function searchInput(search: SourceFormValues["search"]) {
  return compact({
    motsCles: search.motsCles.trim() || undefined,
    domaine: search.domaine.trim() || undefined,
    typeContrat: search.typeContrat.trim() || undefined,
    lieux: search.lieux.trim() || undefined,
    rayon: search.rayon.trim() || undefined,
    emission: search.emission || undefined,
    offresPartenaires: search.offresPartenaires,
    tri: search.tri || undefined,
  })
}

function careerPageParams(values: SourceFormValues["careerPage"]) {
  return {
    listUrl: values.listUrl.trim(),
    postingPattern: values.postingPattern.trim(),
    pagination:
      values.pagination === "param"
        ? { kind: "param", name: values.pageParam.trim() }
        : { kind: values.pagination },
    extraHosts: [...new Set(lines(values.extraHosts))],
    requireJsonLd: values.requireJsonLd,
  }
}

function adapterParams(values: SourceFormValues) {
  switch (values.adapter) {
    case "teamtailor":
    case "factorial": {
      try {
        return { portalUrl: new URL(values.portalUrl).origin }
      } catch {
        return undefined
      }
    }
    case "france-travail": {
      const search = franceTravailSearchSchema.safeParse(
        searchInput(values.search),
      )
      return search.success
        ? {
            searchUrls: [
              franceTravailSearchUrl(search.data),
              ...lines(values.extraSearchUrls),
            ].slice(0, maxFranceTravailSearches),
          }
        : undefined
    }
    case "career-page":
      return parseAdapterParams(
        "career-page",
        careerPageParams(values.careerPage),
      ).success
        ? careerPageParams(values.careerPage)
        : undefined
    case "fixture":
      return isLocalTestOrigin(values.fixtureOrigin)
        ? { origin: new URL(values.fixtureOrigin).origin }
        : undefined
    case "smartrecruiters":
      return {}
    default:
      return undefined
  }
}

// Instantané d'une version : identité, connecteur et ce qu'il en déduit, preuves, limites et
// lieux connus. Les champs vides sont absents.
export function formValuesToSnapshot(
  values: SourceFormValues,
): ScanSourceDraftSnapshot {
  const params = adapterParams(values)
  const derived =
    values.adapter && params ? deriveSourceConfig(values.adapter, params) : null
  const manualHosts = [...new Set(lines(values.manualHosts))]
  const manualListUrls = [...new Set(lines(values.manualListUrls))]
  const siren = values.employerSiren.replace(/\s/g, "")
  const limits = compact({
    maxListPages: values.maxListPages ? +values.maxListPages : undefined,
    maxPostings: values.maxPostings ? +values.maxPostings : undefined,
    minIntervalMs: values.minIntervalMs ? +values.minIntervalMs : undefined,
  })
  const identity =
    values.kind === "employer"
      ? compact({
          kind: "employer" as const,
          employer: values.employerName.trim()
            ? compact({
                name: values.employerName.trim(),
                siren: siren || undefined,
              })
            : undefined,
          employerWebsite: values.employerWebsite.trim() || undefined,
        })
      : { kind: "discovery" as const, employer: null, employerWebsite: null }
  return compact({
    label: values.label.trim(),
    ...identity,
    adapter: values.adapter || undefined,
    adapterParams: params,
    ...(derived ??
      compact({
        listUrls: manualListUrls.length ? manualListUrls : undefined,
        officialHosts: manualHosts.length ? manualHosts : undefined,
      })),
    affiliationProof: values.affiliationUrl
      ? {
          url: values.affiliationUrl.trim(),
          note: values.affiliationNote.trim(),
          checkedAt: values.affiliationCheckedAt,
        }
      : undefined,
    reuse: values.reuseUrl
      ? {
          url: values.reuseUrl.trim(),
          robotsExcerpt: values.reuseRobotsExcerpt.trim(),
          note: values.reuseNote.trim(),
          checkedAt: values.reuseCheckedAt,
        }
      : undefined,
    limits,
    placeAliases: Object.fromEntries(
      values.placeAliases.map((alias) => [
        alias.name.trim(),
        {
          inseeCode: alias.inseeCode.trim(),
          name: alias.communeName.trim(),
          departmentCode: alias.departmentCode.trim(),
        },
      ]),
    ),
  }) as ScanSourceDraftSnapshot
}

function careerPageDefaults(
  params: Record<string, unknown>,
  empty: SourceFormValues["careerPage"],
): SourceFormValues["careerPage"] {
  if (typeof params.listUrl !== "string") return empty
  const pagination = (params.pagination ?? { kind: "none" }) as {
    kind: "none" | "next" | "param"
    name?: string
  }
  return {
    listUrl: params.listUrl,
    postingPattern:
      typeof params.postingPattern === "string" ? params.postingPattern : "",
    pagination: pagination.kind,
    pageParam: pagination.name ?? "page",
    extraHosts: Array.isArray(params.extraHosts)
      ? params.extraHosts.map(String).join("\n")
      : "",
    requireJsonLd: params.requireJsonLd === true,
  }
}

// Valeurs du formulaire d'une version existante.
export function sourceFormDefaults(
  definition: ScanSourceDraftSnapshot,
): SourceFormValues {
  const empty = emptySourceFormValues(definition.kind)
  const params = (definition.adapterParams ?? {}) as Record<string, unknown>
  const searchUrl = Array.isArray(params.searchUrls)
    ? String(params.searchUrls[0] ?? "")
    : ""
  const search = searchUrl ? parseFranceTravailSearchUrl(searchUrl) : null
  const derived =
    definition.adapter && definition.adapterParams
      ? deriveSourceConfig(definition.adapter, definition.adapterParams)
      : null
  return {
    ...empty,
    label: definition.label,
    employerName: definition.employer?.name ?? "",
    employerSiren: definition.employer?.siren ?? "",
    employerWebsite: definition.employerWebsite ?? "",
    adapter: definition.adapter ?? "",
    portalUrl: typeof params.portalUrl === "string" ? params.portalUrl : "",
    search: search
      ? {
          motsCles: search.motsCles ?? "",
          domaine: search.domaine ?? "",
          typeContrat: search.typeContrat ?? "",
          lieux: search.lieux ?? "",
          rayon: search.rayon ?? "",
          emission: search.emission ?? "",
          offresPartenaires: search.offresPartenaires,
          tri: search.tri ?? "",
        }
      : empty.search,
    extraSearchUrls: Array.isArray(params.searchUrls)
      ? params.searchUrls.slice(1).map(String).join("\n")
      : "",
    careerPage: careerPageDefaults(params, empty.careerPage),
    fixtureOrigin: typeof params.origin === "string" ? params.origin : "",
    manualHosts: derived ? "" : (definition.officialHosts ?? []).join("\n"),
    manualListUrls: derived ? "" : (definition.listUrls ?? []).join("\n"),
    affiliationUrl: definition.affiliationProof?.url ?? "",
    affiliationNote: definition.affiliationProof?.note ?? "",
    affiliationCheckedAt: definition.affiliationProof?.checkedAt ?? "",
    reuseUrl: definition.reuse?.url ?? "",
    reuseRobotsExcerpt: definition.reuse?.robotsExcerpt ?? "",
    reuseNote: definition.reuse?.note ?? "",
    reuseCheckedAt: definition.reuse?.checkedAt ?? "",
    maxListPages: definition.limits?.maxListPages?.toString() ?? "",
    maxPostings: definition.limits?.maxPostings?.toString() ?? "",
    minIntervalMs: definition.limits?.minIntervalMs?.toString() ?? "",
    placeAliases: Object.entries(definition.placeAliases ?? {}).map(
      ([name, alias]) => ({
        name,
        inseeCode: alias.inseeCode,
        communeName: alias.name,
        departmentCode: alias.departmentCode,
      }),
    ),
  }
}

// Champs d'une version, dans l'ordre de l'historique.
export const snapshotFields = [
  "label",
  "kind",
  "employer",
  "employerWebsite",
  "adapter",
  "adapterParams",
  "listUrls",
  "postingUrlPattern",
  "officialHosts",
  "affiliationProof",
  "reuse",
  "limits",
  "placeAliases",
] as const
export type SnapshotField = (typeof snapshotFields)[number]
export const snapshotFieldLabels: Record<SnapshotField, string> = {
  label: "Libellé",
  kind: "Type",
  employer: "Employeur",
  employerWebsite: "Site de l'employeur",
  adapter: "Connecteur",
  adapterParams: "Paramètres du connecteur",
  listUrls: "Listes lues",
  postingUrlPattern: "Motif des fiches",
  officialHosts: "Hôtes officiels",
  affiliationProof: "Preuve de rattachement",
  reuse: "Conditions de reprise",
  limits: "Limites de lecture",
  placeAliases: "Lieux connus",
}
// Identité d'une source prête : un motif est exigé pour la modifier.
export const identityFields: readonly SnapshotField[] = [
  "label",
  "kind",
  "employer",
  "employerWebsite",
]

// Champs modifiés entre deux versions, avec leurs valeurs avant et après.
export function revisionDiff(
  before: ScanSourceDraftSnapshot | null,
  after: ScanSourceDraftSnapshot,
) {
  return snapshotFields
    .filter(
      (field) =>
        canonicalJson(before?.[field] ?? null) !==
        canonicalJson(after[field] ?? null),
    )
    .map((field) => ({
      field,
      label: snapshotFieldLabels[field],
      before: before?.[field] ?? null,
      after: after[field] ?? null,
    }))
}
