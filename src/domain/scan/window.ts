import { scanLimits } from "./limits"
import { zonedDayRange, type SourceDate } from "./source-date"
import type { ScanMode } from "./vocabulary"

export type DiscoveryWindow = { start: string; end: string } | null
export function discoveryWindow(
  mode: ScanMode,
  startedAt: string | Date,
): DiscoveryWindow {
  const end = new Date(startedAt).getTime()
  if (!Number.isFinite(end)) throw new RangeError("Début du passage invalide")
  return mode === "bootstrap"
    ? null
    : {
        start: new Date(end - scanLimits.dailyWindowMs).toISOString(),
        end: new Date(end).toISOString(),
      }
}
export function windowDecision(
  sourceDate: SourceDate | null | undefined,
  window: DiscoveryWindow,
): "inside" | "outside" | "unknown" {
  if (!sourceDate) return "unknown"
  if (!window) return "inside"
  const start = Date.parse(window.start),
    end = Date.parse(window.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return "unknown"
  if (sourceDate.precision === "instant") {
    const at = Date.parse(sourceDate.at)
    return Number.isFinite(at)
      ? at >= start && at <= end
        ? "inside"
        : "outside"
      : "unknown"
  }
  const day = zonedDayRange(sourceDate.date, sourceDate.timeZone)
  return day
    ? day.end > start && day.start <= end
      ? "inside"
      : "outside"
    : "unknown"
}
