import { z } from "zod"

import { isValidSiren } from "@/domain/membership"

import { adapterDescriptor, parseAdapterParams } from "./adapter-catalog"
import { scanLimits } from "./limits"
import { checkScanUrl, isTestSourceUrl, type ScanUrlPolicy } from "./url-safety"
import {
  scanAdapterKinds,
  type ScanAdapterKind,
  type ScanSourceKind,
  type ScanSourceRole,
  type ScanSourceStatus,
  type ScanSourceSwitch,
} from "./vocabulary"

// Bornes d'une requête surchargeables par source : elles ne peuvent que se resserrer.
export const scanRequestLimitsSchema = z.object({
  minIntervalMs: z.number().int().min(scanLimits.minIntervalMs).optional(),
  timeoutMs: z.number().int().positive().max(scanLimits.timeoutMs).optional(),
  maxBytes: z.number().int().positive().max(scanLimits.maxBytes).optional(),
})
export type ScanRequestLimits = z.infer<typeof scanRequestLimitsSchema>

// Clé immuable d'une source, lisible dans les URL de l'admin (CHECK scan_sources_key).
export const scanSourceKeyPattern = /^[a-z][a-z0-9-]{1,47}$/
export const scanSourceKeySchema = z.string().regex(scanSourceKeyPattern)
// Hôte exact (SH18) : minuscules, sans port ni chemin (CHECK scan_source_hosts_host).
export const scanHostPattern = /^[a-z0-9.-]+$/
export const scanHostSchema = z.string().max(253).regex(scanHostPattern)

// Un texte absent s'écrit NULL : une chaîne faite d'espaces n'est pas une information.
function filled(max: number) {
  return z.string().max(max).regex(/\S/)
}
const urlSchema = z.url().max(2048)
const proofSchema = z.object({
  url: urlSchema,
  note: filled(2000),
  checkedAt: z.iso.date(),
})
const reuseSchema = proofSchema.extend({ robotsExcerpt: filled(2000) })
const limitsSchema = scanRequestLimitsSchema.extend({
  maxListPages: z
    .number()
    .int()
    .positive()
    .max(scanLimits.maxListPages)
    .optional(),
  maxPostings: z
    .number()
    .int()
    .positive()
    .max(scanLimits.maxPostings)
    .optional(),
})
export const placeAliasSchema = z.object({
  inseeCode: z.string().regex(/^(?:\d{5}|2[AB]\d{3})$/),
  name: filled(200),
  departmentCode: z.string().regex(/^(?:\d{2,3}|2[AB])$/),
})
const postingUrlPatternSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine((value) => {
    try {
      new RegExp(value)
      return true
    } catch {
      return false
    }
  })
const employerSchema = z.object({
  name: filled(200),
  siren: z.string().refine(isValidSiren).optional(),
})

const sourceConfigShape = {
  label: filled(80),
  adapter: z.enum(scanAdapterKinds),
  // Paramètres saisis, validés par le connecteur (adapter-catalog.ts).
  adapterParams: z.record(z.string(), z.unknown()),
  // Déduits des paramètres à l'écriture, puis figés dans la version.
  listUrls: z.array(urlSchema).min(1).max(10),
  postingUrlPattern: postingUrlPatternSchema,
  officialHosts: z.array(scanHostSchema).min(1).max(10),
  affiliationProof: proofSchema,
  reuse: reuseSchema,
  limits: limitsSchema,
  placeAliases: z
    .record(filled(200), placeAliasSchema)
    .refine((aliases) => Object.keys(aliases).length <= 200),
}
const employerShape = {
  kind: z.literal("employer"),
  employer: employerSchema,
  employerWebsite: urlSchema,
}
const discoveryShape = {
  kind: z.literal("discovery"),
  // Un diffuseur d'annonces n'est jamais affecté comme employeur des recrutements (SH17).
  employer: z.null(),
  employerWebsite: z.null(),
}

// Schéma strict : seule une version conforme peut être lue par un passage, une sonde ou un
// échantillon (`scan_source_revisions.complete`).
export const scanSourceSnapshotSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...sourceConfigShape, ...employerShape }),
    z.object({ ...sourceConfigShape, ...discoveryShape }),
  ])
  .superRefine((source, context) => {
    if (!adapterDescriptor(source.adapter).sourceKinds.includes(source.kind))
      context.addIssue({
        code: "custom",
        path: ["adapter"],
        message: "Connecteur incompatible avec ce type de source.",
      })
    const params = parseAdapterParams(source.adapter, source.adapterParams)
    if (!params.success)
      context.addIssue({
        code: "custom",
        path: ["adapterParams"],
        message: z.prettifyError(params.error),
      })
  })
export type ScanSourceSnapshot = z.infer<typeof scanSourceSnapshotSchema>

// Brouillon : seule l'identité est exigée ; chaque champ présent reste valide.
const draftConfig = z.object(sourceConfigShape).partial({
  adapter: true,
  adapterParams: true,
  listUrls: true,
  postingUrlPattern: true,
  officialHosts: true,
  affiliationProof: true,
  reuse: true,
  limits: true,
  placeAliases: true,
})
export const scanSourceDraftSnapshotSchema = z.discriminatedUnion("kind", [
  draftConfig.extend({
    kind: z.literal("employer"),
    employer: employerSchema.optional(),
    employerWebsite: urlSchema.optional(),
  }),
  draftConfig.extend({
    kind: z.literal("discovery"),
    employer: z.null().optional(),
    employerWebsite: z.null().optional(),
  }),
])
export type ScanSourceDraftSnapshot = z.infer<
  typeof scanSourceDraftSnapshotSchema
>

// Configuration lue par les adaptateurs : la version complète et l'état de la ligne.
export type ScanSourceDefinition = ScanSourceSnapshot & {
  key: string
  revision: number
  role: ScanSourceRole
  priority: number
}

export function isCompleteSnapshot(
  snapshot: unknown,
): snapshot is ScanSourceSnapshot {
  return scanSourceSnapshotSchema.safeParse(snapshot).success
}

// Règles d'une source au regard du déploiement : schéma strict, URL autorisées (https, ou
// origine locale de test pour le connecteur de fixtures), listes incluses dans les hôtes.
export function scanSourceDefinitionErrors(
  definition: unknown,
  policy: ScanUrlPolicy,
): string[] {
  const parsed = scanSourceSnapshotSchema.safeParse(definition)
  if (!parsed.success) return [z.prettifyError(parsed.error)]
  const source = parsed.data
  const errors: string[] = []
  const key = (definition as { key?: unknown }).key
  if (key !== undefined && !scanSourceKeySchema.safeParse(key).success)
    errors.push("clé invalide")
  for (const value of [
    ...source.listUrls,
    ...(source.employerWebsite ? [source.employerWebsite] : []),
    source.affiliationProof.url,
    source.reuse.url,
  ]) {
    const url = checkScanUrl(value, policy)
    if (
      !url ||
      (url.protocol !== "https:" &&
        !(source.adapter === "fixture" && isTestSourceUrl(url, policy)))
    )
      errors.push(`URL interdite ${value}`)
  }
  for (const value of source.listUrls) {
    if (!source.officialHosts.includes(new URL(value).hostname))
      errors.push(`hôte non officiel ${value}`)
  }
  return errors
}

// D4 : champs qui changent ce qui est lu. Leur empreinte (SHA-256 de ce JSON canonique,
// `config_hash`) identifie la configuration testée par une sonde ou un échantillon.
export const sensitiveSourceFields = [
  "adapter",
  "adapterParams",
  "listUrls",
  "postingUrlPattern",
  "officialHosts",
] as const
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    )
  return value ?? null
}
// JSON aux clés triées : deux instantanés égaux s'écrivent de la même façon (jsonb réordonne).
export function canonicalJson(value: unknown) {
  return JSON.stringify(canonical(value))
}
export function sourceFingerprint(snapshot: {
  readonly [field: string]: unknown
}) {
  return canonicalJson(
    Object.fromEntries(
      sensitiveSourceFields.map((field) => [field, snapshot[field] ?? null]),
    ),
  )
}

// Ce que l'écran admin reçoit d'une source.
export type ScanSourceSummary = {
  key: string
  label: string
  kind: ScanSourceKind
  role: ScanSourceRole
  status: ScanSourceStatus
  adapter: ScanAdapterKind | null
  revision: number
  version: number
  officialHosts: string[]
  // Date la plus récente des vérifications documentées (rattachement, conditions de reprise).
  checkedAt: string | null
  complete: boolean
  // Sonde et échantillon possibles : configuration complète, source non écartée, connecteur
  // disponible sur ce déploiement.
  testable: boolean
  enabled: boolean
  dailyEnabled: boolean
  autoPublish: boolean
  suspended: boolean
  // Raison pour laquelle chaque interrupteur ne peut pas être activé ; null s'il peut l'être.
  switchBlockers: Record<ScanSourceSwitch, string | null>
}
