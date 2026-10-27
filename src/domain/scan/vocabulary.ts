// Source unique des valeurs du scan, également utilisée par les enums SQL.
export const scanRunTriggers = ["admin", "cron"] as const
export type ScanRunTrigger = (typeof scanRunTriggers)[number]
export const scanRunTriggerLabels: Record<ScanRunTrigger, string> = {
  admin: "Administrateur",
  cron: "Tâche planifiée",
}
export const scanModes = ["bootstrap", "daily"] as const
export type ScanMode = (typeof scanModes)[number]
export const scanModeLabels: Record<ScanMode, string> = {
  bootstrap: "Remplissage initial",
  daily: "Passage quotidien",
}
export const scanRunStatuses = [
  "queued",
  "running",
  "stopping",
  "stopped",
  "completed",
  "partial",
  "failed",
] as const
export type ScanRunStatus = (typeof scanRunStatuses)[number]
export const scanRunStatusLabels: Record<ScanRunStatus, string> = {
  queued: "En attente",
  running: "En cours",
  stopping: "Arrêt demandé",
  stopped: "Arrêté",
  completed: "Terminé",
  partial: "Partiel",
  failed: "Échec",
}
export const scanRunSourceStatuses = [
  "pending",
  "listing",
  "processing",
  "done",
  "failed",
  "blocked",
  "skipped",
] as const
export type ScanRunSourceStatus = (typeof scanRunSourceStatuses)[number]
export const scanRunSourceStatusLabels: Record<ScanRunSourceStatus, string> = {
  pending: "En attente",
  listing: "Lecture des listes",
  processing: "Lecture des annonces",
  done: "Terminée",
  failed: "Échec",
  blocked: "Bloquée",
  skipped: "Non couverte",
}
export const scanCandidateStatuses = [
  "discovered",
  "excluded",
  "failed",
  "to_review",
  "published",
  "rejected",
] as const
export type ScanCandidateStatus = (typeof scanCandidateStatuses)[number]
export const scanCandidateStatusLabels: Record<ScanCandidateStatus, string> = {
  discovered: "Découverte",
  excluded: "Écartée",
  failed: "Échec",
  to_review: "À vérifier",
  published: "Publiée",
  rejected: "Rejetée",
}
export const exclusionReasons = [
  "no_content",
  "out_of_scope",
  "closed",
  "outside_window",
  "already_known",
  "not_french",
  "outside_france",
  "test_data",
] as const
export type ExclusionReason = (typeof exclusionReasons)[number]
export const exclusionReasonLabels: Record<ExclusionReason, string> = {
  no_content: "Sans contenu exploitable",
  out_of_scope: "Hors périmètre",
  closed: "Offre close",
  outside_window: "Hors fenêtre",
  already_known: "Déjà connue",
  not_french: "Annonce non francophone",
  outside_france: "Poste hors de France",
  test_data: "Données de test",
}
export const rejectionReasons = [
  "out_of_scope",
  "closed",
  "duplicate",
  "no_content",
  "missing_minimum",
  "employer_unreachable",
  "other",
  // Source écartée : ajouté en dernier, car isAdmissionRejection lit les quatre premiers motifs.
  "source_withdrawn",
] as const
export type RejectionReason = (typeof rejectionReasons)[number]
export const rejectionReasonLabels: Record<RejectionReason, string> = {
  out_of_scope: "Hors périmètre",
  closed: "Offre close",
  duplicate: "Doublon",
  no_content: "Sans contenu",
  missing_minimum: "Minimum incomplet",
  employer_unreachable: "Employeur injoignable",
  other: "Autre",
  source_withdrawn: "Source écartée",
}
// Motifs proposés à l'admin ; `source_withdrawn` n'est posé que par l'archivage d'une source.
export const manualRejectionReasons = rejectionReasons.filter(
  (reason) => reason !== "source_withdrawn",
)
export function isAdmissionRejection(reason: RejectionReason) {
  return rejectionReasons.slice(0, 4).includes(reason)
}
export const scanReviewKinds = [
  "duplicate",
  "divergence",
  "incident",
  "occupation",
] as const
export type ScanReviewKind = (typeof scanReviewKinds)[number]
export const scanReviewKindLabels: Record<ScanReviewKind, string> = {
  duplicate: "Doublon",
  divergence: "Divergence",
  incident: "Incident",
  occupation: "Suggestion de métier",
}
export const scanReviewStatuses = ["open", "resolved", "dismissed"] as const
export type ScanReviewStatus = (typeof scanReviewStatuses)[number]
export const scanReviewStatusLabels: Record<ScanReviewStatus, string> = {
  open: "À traiter",
  resolved: "Résolue",
  dismissed: "Écartée",
}
export const publicationKinds = ["human", "automatic"] as const
export type PublicationKind = (typeof publicationKinds)[number]
export const publicationKindLabels: Record<PublicationKind, string> = {
  human: "Vérifiée par un humain",
  automatic: "Sourcée sur internet",
}

export const scanIssueDefinitions = {
  company: { label: "Entreprise à identifier", blocking: true },
  seasonal_contract: { label: "Contrat saisonnier à établir", blocking: true },
  location: { label: "Lieu à résoudre", blocking: true },
  period: { label: "Période ou durée à établir", blocking: true },
  application: { label: "Canal de candidature à établir", blocking: true },
  official_source: { label: "Source officielle à établir", blocking: true },
  activity: { label: "Activité du recrutement à vérifier", blocking: true },
  blocked_domain: { label: "Destination sur un domaine exclu", blocking: true },
  duplicate: { label: "Doublon potentiel", blocking: true },
  contract_contradiction: { label: "Contrat contradictoire", blocking: true },
  period_contradiction: { label: "Période contradictoire", blocking: true },
  season_contradiction: {
    label: "Saison été/hiver à confirmer",
    blocking: false,
  },
  season_unknown: { label: "Saison été/hiver non précisée", blocking: false },
  multiple_positions: {
    label: "Associations entre postes à vérifier",
    blocking: true,
  },
  year_inferred: { label: "Année déduite à vérifier", blocking: true },
  reused_identity: {
    label: "Identifiant réutilisé pour une autre période",
    blocking: true,
  },
  detail_unreadable: { label: "Source officielle illisible", blocking: true },
  publication_date_unknown: {
    label: "Date de publication inconnue",
    blocking: false,
  },
  optional_contradiction: {
    label: "Champ facultatif à confirmer",
    blocking: false,
  },
  occupation_unknown: { label: "Métier à rattacher", blocking: false },
  form_only: { label: "Candidature externe", blocking: false },
  general_contact_only: {
    label: "Contact général uniquement",
    blocking: false,
  },
  text_truncated: { label: "Contenu tronqué", blocking: false },
  invalid_values: {
    label: "Valeurs à corriger avant publication",
    blocking: true,
  },
  source_withdrawn: {
    label: "Source écartée : publication impossible depuis ce dossier",
    blocking: true,
  },
} as const
export type ScanIssueCode = keyof typeof scanIssueDefinitions
export const scanIssueCodes = Object.keys(
  scanIssueDefinitions,
) as ScanIssueCode[]
export type ScanIssue = {
  code: ScanIssueCode
  label: string
  blocking: boolean
  field?: string
}
export function scanIssue(code: ScanIssueCode, field?: string): ScanIssue {
  if (code === "seasonal_contract" && field === "season")
    code = "season_unknown"
  return { code, ...scanIssueDefinitions[code], ...(field ? { field } : {}) }
}
export function uniqueIssues(issues: readonly ScanIssue[]) {
  return issues.filter(
    (issue, index) =>
      issues.findIndex(
        (other) => other.code === issue.code && other.field === issue.field,
      ) === index,
  )
}

// Registre des sources (SH20).
export const scanSourceKinds = ["employer", "discovery"] as const
export type ScanSourceKind = (typeof scanSourceKinds)[number]
export const scanSourceKindLabels: Record<ScanSourceKind, string> = {
  employer: "Portail employeur",
  discovery: "Découverte",
}
export const scanSourceStatuses = [
  "draft",
  "ready",
  "rejected",
  "archived",
] as const
export type ScanSourceStatus = (typeof scanSourceStatuses)[number]
export const scanSourceStatusLabels: Record<ScanSourceStatus, string> = {
  draft: "Brouillon",
  ready: "Prête",
  rejected: "Écartée",
  archived: "Archivée",
}
export const scanSourceRoles = ["primary", "reserve"] as const
export type ScanSourceRole = (typeof scanSourceRoles)[number]
export const scanSourceRoleLabels: Record<ScanSourceRole, string> = {
  primary: "Principale",
  reserve: "Réserve",
}
export const scanAdapterKinds = [
  "teamtailor",
  "factorial",
  "france-travail",
  "smartrecruiters",
  "fixture",
] as const
export type ScanAdapterKind = (typeof scanAdapterKinds)[number]
export const scanAdapterLabels: Record<ScanAdapterKind, string> = {
  teamtailor: "Teamtailor",
  factorial: "Factorial",
  "france-travail": "France Travail (recherche publique)",
  smartrecruiters: "SmartRecruiters",
  fixture: "Fixtures locales",
}
export const scanReuseDecisions = [
  "pending",
  "authorized",
  "accepted",
  "refused",
] as const
export type ScanReuseDecision = (typeof scanReuseDecisions)[number]
export const scanReuseDecisionLabels: Record<ScanReuseDecision, string> = {
  pending: "À décider",
  authorized: "Autorisation écrite",
  accepted: "Acceptée par le fondateur",
  refused: "Refusée",
}
export const scanSourceSwitches = [
  "enabled",
  "dailyEnabled",
  "autoPublish",
] as const
export type ScanSourceSwitch = (typeof scanSourceSwitches)[number]
export const scanSourceSwitchLabels: Record<ScanSourceSwitch, string> = {
  enabled: "Activée",
  dailyEnabled: "Passages quotidiens",
  autoPublish: "Publication automatique (passages quotidiens)",
}
export const scanSourceEventKinds = [
  "imported",
  "created",
  "revised",
  "status_changed",
  "switched",
  "reuse_decided",
  "probed",
  "sampled",
  "detected",
  "suspended",
  "resumed",
  "company_linked",
  "domain_excluded",
  "alias_learned",
] as const
export type ScanSourceEventKind = (typeof scanSourceEventKinds)[number]
export const scanSourceEventKindLabels: Record<ScanSourceEventKind, string> = {
  imported: "Reprise du registre historique",
  created: "Création",
  revised: "Modification",
  status_changed: "Changement de statut",
  switched: "Interrupteur",
  reuse_decided: "Décision de reprise",
  probed: "Test d’accès",
  sampled: "Échantillon",
  detected: "Détection",
  suspended: "Suspension",
  resumed: "Reprise après suspension",
  company_linked: "Fiche entreprise liée",
  domain_excluded: "Domaine exclu",
  alias_learned: "Lieu mémorisé",
}
