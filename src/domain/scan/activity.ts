import type { ScanProposal } from "./proposal"
import { periodBounds } from "./period"
import { zonedDayRange, type SourceDate } from "./source-date"

function deadlinePassed(date: SourceDate, today: string, now: string) {
  if (date.precision === "instant") return Date.parse(date.at) < Date.parse(now)
  // Une échéance civile reste valable jusqu'à la fin de sa journée dans son fuseau.
  const day = zonedDayRange(date.date, date.timeZone)
  return day ? day.end <= Date.parse(now) : date.date < today
}
export function postingClosed(
  proposal: ScanProposal,
  { today, now }: { today: string; now: string },
) {
  if (
    proposal.activity.status === "established" &&
    proposal.activity.value === "closed"
  )
    return true
  if (
    proposal.activity.status === "contradictory" &&
    proposal.activity.values.includes("closed")
  )
    return true
  if (
    proposal.applicationDeadline.status === "established" &&
    deadlinePassed(proposal.applicationDeadline.value, today, now)
  )
    return true
  const bounds =
    proposal.period.status === "established"
      ? periodBounds(proposal.period.value)
      : null
  return !!bounds && bounds.endDate < today
}
