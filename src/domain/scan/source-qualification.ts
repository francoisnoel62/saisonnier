import { isBlockedHost } from "@/domain/blocked-domains"
import { isTourismActivity } from "@/domain/naf"

import { scanLimits } from "./limits"
import type { ScanSourceDraftSnapshot } from "./source"
import type { ScanReuseDecision, ScanSourceKind } from "./vocabulary"

// D5 : qualification d'une source (§10.3). « Marquer prête » exige qu'aucun point bloquant ne
// manque ; les alertes informent sans empêcher.
export const qualificationItemCodes = [
  "adapter",
  "identity",
  "affiliation",
  "reuse_terms",
  "reuse_decision",
  "tested",
  "blocked_domains",
  "scope",
  "company",
  "scheduled_access",
  "freshness",
] as const
export type QualificationItemCode = (typeof qualificationItemCodes)[number]
export const qualificationItemLabels: Record<QualificationItemCode, string> = {
  adapter: "Connecteur disponible et paramètres valides",
  identity: "Employeur nommé avec son site officiel",
  affiliation: "Preuve de rattachement",
  reuse_terms: "Conditions consultées",
  reuse_decision: "Décision de reprise",
  tested: "Échantillon réussi de la configuration actuelle",
  blocked_domains: "Cohérence avec les domaines exclus",
  scope: "Activité dans le tourisme et les loisirs",
  company: "Fiche entreprise",
  scheduled_access: "Justification des passages quotidiens",
  freshness: "Vérification documentée récente",
}
// Rappel accolé à la décision de reprise.
export const robotsIsNotPermission =
  "Une lecture autorisée par robots.txt ne vaut pas autorisation de republier."

export type QualificationState = "ok" | "missing" | "alert"
export type QualificationItem = {
  code: QualificationItemCode
  label: string
  state: QualificationState
  // Bloquant pour « Marquer prête » (le point `scheduled_access` ne bloque que les passages
  // quotidiens d'une découverte).
  blocking: boolean
  detail?: string
}
export type SampleRecord = {
  at: Date | string
  configHash: string
  ok: boolean
  empty: boolean
}
export type QualificationContext = {
  kind: ScanSourceKind
  definition: ScanSourceDraftSnapshot
  complete: boolean
  // Règles du déploiement (scanSourceDefinitionErrors).
  definitionErrors: readonly string[]
  adapterAvailable: boolean
  adapterUnavailableReason?: string
  reuseDecision: ScanReuseDecision
  scheduledAccessBasis: string | null
  configHash: string
  // Dernier échantillon de la configuration actuelle.
  lastSample: SampleRecord | null
  blockedDomains: readonly string[]
  company: { exists: boolean; nafCode: string | null } | null
  now: Date
}

function hostOf(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname : null
  } catch {
    return null
  }
}
const day = 24 * 60 * 60 * 1_000

export function sampleIsRecent(
  sample: SampleRecord | null,
  configHash: string,
  now: Date,
  maxAgeMs: number = scanLimits.sourceQualificationTestMaxAgeMs,
) {
  return (
    !!sample &&
    sample.ok &&
    sample.configHash === configHash &&
    now.getTime() - new Date(sample.at).getTime() <= maxAgeMs
  )
}

export function qualificationItems(
  context: QualificationContext,
): QualificationItem[] {
  const { definition, kind } = context
  const items: QualificationItem[] = []
  const add = (
    code: QualificationItemCode,
    state: QualificationState,
    blocking: boolean,
    detail?: string,
  ) =>
    items.push({
      code,
      label: qualificationItemLabels[code],
      state,
      blocking,
      ...(detail ? { detail } : {}),
    })

  if (!definition.adapter)
    add("adapter", "missing", true, "Connecteur à choisir.")
  else if (!context.adapterAvailable)
    add(
      "adapter",
      "missing",
      true,
      context.adapterUnavailableReason ??
        "Connecteur indisponible sur ce déploiement.",
    )
  else if (!context.complete || context.definitionErrors.length)
    add(
      "adapter",
      "missing",
      true,
      context.definitionErrors.length
        ? `Configuration incomplète : ${context.definitionErrors.join(" ; ")}.`
        : "Configuration incomplète.",
    )
  else add("adapter", "ok", true)

  if (kind === "discovery")
    add("identity", "ok", true, "Diffuseur : aucun employeur n'est affecté.")
  else if (!definition.employer?.name || !definition.employerWebsite)
    add(
      "identity",
      "missing",
      true,
      "Nom de l'employeur et site officiel à renseigner.",
    )
  else
    add(
      "identity",
      "ok",
      true,
      definition.employer.siren ? undefined : "SIREN conseillé.",
    )

  add(
    "affiliation",
    definition.affiliationProof ? "ok" : "missing",
    true,
    definition.affiliationProof
      ? undefined
      : kind === "discovery"
        ? "Provenance du diffuseur à documenter."
        : "Page officielle de l'employeur qui mène au portail.",
  )
  add(
    "reuse_terms",
    definition.reuse ? "ok" : "missing",
    true,
    definition.reuse
      ? undefined
      : "CGU ou mentions, extrait de robots.txt et date de consultation.",
  )
  add(
    "reuse_decision",
    context.reuseDecision === "authorized" ||
      context.reuseDecision === "accepted"
      ? "ok"
      : "missing",
    true,
    context.reuseDecision === "refused"
      ? `Reprise refusée. ${robotsIsNotPermission}`
      : context.reuseDecision === "pending"
        ? `Décision de reprise à prendre. ${robotsIsNotPermission}`
        : robotsIsNotPermission,
  )

  if (!sampleIsRecent(context.lastSample, context.configHash, context.now))
    add(
      "tested",
      "missing",
      true,
      "Aucun échantillon réussi de cette configuration depuis 30 jours.",
    )
  else if (context.lastSample?.empty)
    add(
      "tested",
      "alert",
      true,
      "Liste vide : extraction à revérifier dès la première offre.",
    )
  else add("tested", "ok", true)

  const hosts = [
    ...(definition.officialHosts ?? []),
    ...(definition.listUrls ?? []).map(hostOf),
  ].filter((host): host is string => !!host)
  if (kind === "discovery") {
    const uncovered = [...new Set(hosts)].filter(
      (host) => !isBlockedHost(host, context.blockedDomains),
    )
    add(
      "blocked_domains",
      uncovered.length || !hosts.length ? "missing" : "ok",
      true,
      uncovered.length
        ? `Domaine exclu à ajouter pour ${uncovered.join(", ")} : un job-board n'est qu'une découverte.`
        : !hosts.length
          ? "Hôtes officiels à renseigner."
          : undefined,
    )
  } else {
    const blocked = [...new Set([...hosts, hostOf(definition.employerWebsite)])]
      .filter((host): host is string => !!host)
      .filter((host) => isBlockedHost(host, context.blockedDomains))
    add(
      "blocked_domains",
      blocked.length ? "missing" : "ok",
      true,
      blocked.length
        ? `Domaine exclu : ${blocked.join(", ")}. Un portail employeur ne peut pas être hébergé sur un job-board.`
        : undefined,
    )
    add(
      "scope",
      context.company?.nafCode && isTourismActivity(context.company.nafCode)
        ? "ok"
        : "alert",
      false,
      context.company?.nafCode
        ? isTourismActivity(context.company.nafCode)
          ? undefined
          : `Code NAF ${context.company.nafCode} hors du tourisme et des loisirs.`
        : "Activité à vérifier (code NAF inconnu).",
    )
    add(
      "company",
      context.company?.exists ? "ok" : "alert",
      false,
      context.company?.exists
        ? undefined
        : "Aucune fiche entreprise pour ce SIREN : à créer avant la revue (SH15).",
    )
  }
  if (kind === "discovery")
    add(
      "scheduled_access",
      context.scheduledAccessBasis ? "ok" : "alert",
      false,
      context.scheduledAccessBasis
        ? undefined
        : "Requise pour les passages quotidiens (API officielle ou avis juridique écrit).",
    )
  const checkedAt = [
    definition.affiliationProof?.checkedAt,
    definition.reuse?.checkedAt,
  ]
    .filter((date): date is string => !!date)
    .sort()
    .at(-1)
  add(
    "freshness",
    checkedAt &&
      context.now.getTime() - new Date(`${checkedAt}T00:00:00Z`).getTime() <=
        scanLimits.qualificationMaxAgeDays * day
      ? "ok"
      : "alert",
    false,
    checkedAt
      ? `Dernière vérification documentée le ${checkedAt}.`
      : "Aucune vérification documentée.",
  )
  return items
}

export function qualificationGaps(items: readonly QualificationItem[]) {
  return items.filter((item) => item.blocking && item.state === "missing")
}
export function canMarkReady(items: readonly QualificationItem[]) {
  return qualificationGaps(items).length === 0
}
