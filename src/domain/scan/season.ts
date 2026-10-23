import type { Season } from "@/domain/offer"

import {
  absent,
  resolveFacts,
  type ProposalField,
  type RuleResult,
} from "./field"
import type { Observation } from "./observation"
import { periodBounds, type Period } from "./period"
import { addDays } from "./source-date"
import { fold, positiveMatches, textObservations } from "./text"
import { scanIssue } from "./vocabulary"

function periodSeason(period: Period): Season | null {
  const bounds = periodBounds(period)
  if (!bounds) return null
  const startMonth = +bounds.startDate.slice(5, 7)
  const season: Season =
    startMonth >= 5 && startMonth <= 10 ? "summer" : "winter"
  // Au plus six mois dans une même saison. Tester aussi les mois intermédiaires.
  if (
    Date.parse(bounds.endDate) - Date.parse(bounds.startDate) >
    184 * 86_400_000
  )
    return null
  for (
    let date = bounds.startDate;
    date <= bounds.endDate;
    date = addDays(date, 1)
  ) {
    const month = +date.slice(5, 7)
    if ((month >= 5 && month <= 10 ? "summer" : "winter") !== season)
      return null
  }
  return season
}
export function extractSeason(
  observations: readonly Observation[],
  period: ProposalField<Period>,
): RuleResult<Season> {
  const facts = textObservations(observations, [
    "title",
    "description",
    "postingText",
    "season",
    "contract",
    "period",
  ]).flatMap((observation) => {
    const text = fold(observation.value)
    const values: Season[] = []
    if (
      positiveMatches(text, /\b(?:hiver|hivernal\w*)\b/).length ||
      (observation.field === "season" && text === "winter")
    )
      values.push("winter")
    const summer = positiveMatches(text, /\b(?:ete|estival\w*)\b/).filter(
      (match) =>
        !/\b(?:a|ont|avait|avaient|avons|avez|ayant)\s+$/.test(
          text.slice(0, match.index),
        ),
    )
    if (summer.length || (observation.field === "season" && text === "summer"))
      values.push("summer")
    return values.map((value) => ({ value, evidence: observation.evidence }))
  })
  const explicit = resolveFacts(facts)
  const dates =
    period.status === "established" ? periodSeason(period.value) : null
  if (dates)
    facts.push(
      ...period.evidence.map((evidence) => ({ value: dates, evidence })),
    )
  const field = resolveFacts(facts)
  if (field.status === "contradictory")
    return { field, issues: [scanIssue("season_contradiction")] }
  if (
    explicit.status === "established" &&
    period.status === "established" &&
    period.value.startDate &&
    period.value.endDate &&
    !dates
  )
    return {
      field: {
        status: "contradictory",
        values: [
          explicit.value,
          explicit.value === "winter" ? "summer" : "winter",
        ],
        evidence: [...explicit.evidence, ...period.evidence],
      },
      issues: [scanIssue("season_contradiction")],
    }
  if (explicit.status === "absent" && !dates && period.status !== "absent")
    return {
      field: { status: "to_verify", evidence: period.evidence },
      issues: [],
    }
  return { field: facts.length ? field : absent(), issues: [] }
}
