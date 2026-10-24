import type { ScanRunSourceStatus } from "./vocabulary"

export const activeRunStatuses = ["queued", "running", "stopping"] as const
export type TerminalRunStatus = "stopped" | "completed" | "partial" | "failed"

export function finalRunStatus(
  sources: readonly { status: ScanRunSourceStatus }[],
  { stopRequested }: { stopRequested: boolean },
): TerminalRunStatus {
  if (stopRequested) return "stopped"
  return sources.some((source) => source.status !== "done")
    ? "partial"
    : "completed"
}
