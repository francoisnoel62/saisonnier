import type { ScanFailureReason, RobotsDecision } from "./http"

export type ScanProbeRequest = {
  kind: "list" | "posting"
  url: string
  pageUrl?: string
  ok: boolean
  status?: number
  finalUrl?: string
  elapsedMs: number
  waitedMs: number
  bytes?: number
  contentType?: string
  reason?: ScanFailureReason
  robots: RobotsDecision[]
  jobPosting: "valid" | "invalid_json" | "absent"
  rssItems: number
  pagination: boolean
  postingLinks: number
}
export type ScanProbeResult = {
  sourceKey: string
  deploymentUrl: string
  probedAt: string
  requests: ScanProbeRequest[]
}
