export const scanLimits = {
  concurrentRequestsPerHost: 1,
  concurrentHosts: 3,
  minIntervalMs: 2_000,
  // Délai d'un échange HTTP, compté à partir de son envoi (attente de politesse exclue).
  timeoutMs: 15_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
  // Recul appliqué à l'hôte après un 429 sans Retry-After.
  defaultRetryAfterMs: 60_000,
  maxAttempts: 3,
  batchBudgetMs: 120_000,
  // Sonde de l'admin : sous la durée maximale de la page /admin/scan (120 s).
  probeBudgetMs: 100_000,
  maxListPages: 20,
  maxPostings: 400,
  refreshIntervalMs: 5_000,
  bootstrapTarget: 50,
  bootstrapDeadlineMs: 6 * 60 * 60 * 1_000,
  dailyWindowMs: 72 * 60 * 60 * 1_000,
  // Registre des sources (plan scan V2-01, SH30).
  sourceTestCooldownMs: 30_000,
  sourceTestsKept: 20,
  sourceQualificationTestMaxAgeMs: 30 * 24 * 60 * 60 * 1_000,
  sourceEditTestMaxAgeMs: 60 * 60 * 1_000,
  maxEnabledSources: 20,
  suspendAfterBlockedRuns: 3,
  qualificationMaxAgeDays: 180,
  // SH31 : au-delà, l'écran propose de passer la découverte en réserve (sans rien changer seul).
  discoveryCoverageTarget: 0.75,
} as const
