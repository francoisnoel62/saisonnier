export type ScanFailureReason =
  | "invalid_url"
  | "blocked_address"
  | "robots_disallowed"
  | "timeout"
  | "too_large"
  | "unsupported_type"
  | "too_many_redirects"
  | "rate_limited"
  | "access_denied"
  | "not_found"
  | "gone"
  | "http_error"
  | "network"

export type RobotsDecision = {
  url: string
  status?: number
  allowed: boolean
  crawlDelayMs: number
}

export type ScanFailure = {
  ok: false
  reason: ScanFailureReason
  status?: number
  retryAfterMs?: number
}
export type ScanFetchResult = (
  | {
      ok: true
      status: number
      finalUrl: string
      contentType: string
      body: string
      bytes: number
      elapsedMs: number
      fetchedAt: string
    }
  | ScanFailure
) & { robots: RobotsDecision[] }
