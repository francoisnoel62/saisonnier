import type { DurationUnit } from "@/domain/offer"

import { absent, resolveFacts, type RuleResult } from "./field"
import {
  postingObservations,
  type Evidence,
  type Observation,
} from "./observation"
import { addDays, civilDate, frenchMonths, validCivilDate } from "./source-date"
import { fold, isNegated, textObservations } from "./text"
import { scanIssue } from "./vocabulary"

export type Period = {
  startDate?: string
  endDate?: string
  duration?: { value: number; unit: DurationUnit }
}
const months = frenchMonths.join("|")
const token = `(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}(?:/\\d{4})?|\\d{1,2}(?:er)?\\s+(?:${months})(?:\\s+\\d{4})?)`
function dateParts(text: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] }
  const numeric = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(text)
  if (numeric)
    return {
      year: numeric[3] ? +numeric[3] : undefined,
      month: +numeric[2],
      day: +numeric[1],
    }
  const french = new RegExp(
    `^(\\d{1,2})(?:er)?\\s+(${months})(?:\\s+(\\d{4}))?$`,
  ).exec(text)
  return french
    ? {
        day: +french[1],
        month:
          frenchMonths.indexOf(french[2] as (typeof frenchMonths)[number]) + 1,
        year: french[3] ? +french[3] : undefined,
      }
    : null
}
export function isPeriod(value: unknown): value is Period {
  if (!value || typeof value !== "object") return false
  const p = value as Period
  return (
    !!(p.startDate || p.endDate || p.duration) &&
    (!p.startDate || validCivilDate(p.startDate)) &&
    (!p.endDate || validCivilDate(p.endDate)) &&
    (!p.startDate || !p.endDate || p.startDate <= p.endDate) &&
    (!p.duration ||
      (Number.isSafeInteger(p.duration.value) &&
        p.duration.value > 0 &&
        (p.duration.unit === "weeks" || p.duration.unit === "months")))
  )
}
export function completePeriod(period: Period) {
  return !!(period.startDate && period.endDate) || !!period.duration
}
function durationEnd(
  startDate: string,
  { value, unit }: NonNullable<Period["duration"]>,
) {
  let expected: string
  if (unit === "weeks") expected = addDays(startDate, value * 7)
  else {
    const date = new Date(`${startDate}T00:00:00Z`)
    const day = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + value)
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate()
    date.setUTCDate(Math.min(day, last))
    expected = date.toISOString().slice(0, 10)
  }
  return expected
}
// Bornes internes pour comparer les recrutements et qualifier la saison. Une fin
// calculée ne devient jamais un champ « endDate » proposé à la place de la source.
export function periodBounds(
  period: Period,
): { startDate: string; endDate: string } | null {
  if (!isPeriod(period) || !period.startDate) return null
  try {
    const endDate =
      period.endDate ??
      (period.duration
        ? durationEnd(period.startDate, period.duration)
        : undefined)
    return endDate && validCivilDate(endDate)
      ? { startDate: period.startDate, endDate }
      : null
  } catch {
    return null
  }
}
function durationCompatible(period: Period) {
  if (!period.startDate || !period.endDate || !period.duration) return true
  const expected = periodBounds({
    startDate: period.startDate,
    duration: period.duration,
  })?.endDate
  if (!expected) return false
  // La source peut compter le dernier jour inclus ou donner le jour anniversaire.
  const difference = Date.parse(expected) - Date.parse(period.endDate)
  return difference >= 0 && difference <= 86_400_000
}
export function extractPeriod(
  observations: readonly Observation[],
  { referenceDate }: { referenceDate: string },
): RuleResult<Period> {
  if (!validCivilDate(referenceDate))
    throw new RangeError("Date de référence invalide")
  const facts: { value: Period; evidence: Evidence }[] = []
  let inferred = false,
    unclear = false
  const unclearEvidence: Evidence[] = []
  for (const observation of postingObservations(observations)) {
    if (observation.field === "period" && isPeriod(observation.value))
      facts.push({ value: observation.value, evidence: observation.evidence })
    if (
      (observation.field === "startDate" || observation.field === "endDate") &&
      typeof observation.value === "string" &&
      validCivilDate(observation.value)
    )
      facts.push({
        value: { [observation.field]: observation.value },
        evidence: observation.evidence,
      })
    if (
      observation.field === "duration" &&
      isPeriod({ duration: observation.value })
    )
      facts.push({
        value: { duration: observation.value as Period["duration"] },
        evidence: observation.evidence,
      })
  }
  for (const observation of textObservations(observations, [
    "title",
    "description",
    "postingText",
    "period",
    "contract",
  ])) {
    const text = fold(observation.value)
    const rangePattern = new RegExp(
      `(?:\\bdu\\s+)?(${token})\\s+(?:au|a|jusqu'au)\\s+(${token})`,
      "g",
    )
    for (const match of text.matchAll(rangePattern)) {
      if (isNegated(text, match.index, match[0].length)) continue
      const start = dateParts(match[1])!,
        end = dateParts(match[2])!
      let startYear = start.year,
        endYear = end.year
      if (
        !startYear &&
        endYear &&
        (start.month < end.month ||
          (start.month === end.month && start.day <= end.day))
      )
        startYear = endYear
      if (
        startYear &&
        !endYear &&
        (start.month < end.month ||
          (start.month === end.month && start.day <= end.day))
      )
        endYear = startYear
      if (!start.year && !end.year) {
        inferred = true
        for (const year of [
          +referenceDate.slice(0, 4) - 1,
          +referenceDate.slice(0, 4),
          +referenceDate.slice(0, 4) + 1,
        ]) {
          const crossesYear =
            start.month > end.month ||
            (start.month === end.month && start.day > end.day)
          const candidateEnd = civilDate(
            year + (crossesYear ? 1 : 0),
            end.month,
            end.day,
          )
          if (candidateEnd && candidateEnd >= referenceDate) {
            startYear = year
            endYear = year + (crossesYear ? 1 : 0)
            break
          }
        }
      }
      const startDate = startYear
        ? civilDate(startYear, start.month, start.day)
        : null
      const endDate = endYear ? civilDate(endYear, end.month, end.day) : null
      if (startDate && endDate && startDate <= endDate)
        facts.push({
          value: { startDate, endDate },
          evidence: observation.evidence,
        })
      else {
        unclear = true
        unclearEvidence.push(observation.evidence)
      }
    }
    for (const match of text.matchAll(/\b(\d+)\s+(mois|semaines?)\b/g)) {
      const prefix =
        text
          .slice(0, match.index)
          .split(/[,.;!?\n]/)
          .at(-1) ?? ""
      if (
        /\b(?:experience|essai|formation|preavis|conges|logement)\b[^.;!?\n]{0,35}$/.test(
          prefix,
        )
      )
        continue
      if (
        Number.isSafeInteger(+match[1]) &&
        +match[1] > 0 &&
        !isNegated(text, match.index, match[0].length)
      )
        facts.push({
          value: {
            duration: {
              value: +match[1],
              unit: match[2] === "mois" ? "months" : "weeks",
            },
          },
          evidence: observation.evidence,
        })
    }
    for (const match of text.matchAll(
      new RegExp(
        `(?:a partir du|debut(?: du contrat)?(?: le| au)?|demarrage le)\\s+(${token})`,
        "g",
      ),
    )) {
      if (isNegated(text, match.index, match[0].length)) continue
      const parts = dateParts(match[1])!
      let year = parts.year
      if (!year) {
        inferred = true
        year = +referenceDate.slice(0, 4)
        const date = civilDate(year, parts.month, parts.day)
        if (date && date < referenceDate) year++
      }
      const startDate = civilDate(year, parts.month, parts.day)
      if (startDate)
        facts.push({ value: { startDate }, evidence: observation.evidence })
      else {
        unclear = true
        unclearEvidence.push(observation.evidence)
      }
    }
    if (
      new RegExp(
        `\\b(?:de|du)\\s+(?:${months})\\s+(?:a|au)\\s+(?:${months})\\b`,
      ).test(text)
    ) {
      unclear = true
      unclearEvidence.push(observation.evidence)
    }
  }
  if (!facts.length)
    return {
      field: unclear
        ? { status: "to_verify", evidence: unclearEvidence }
        : absent(),
      issues: inferred ? [scanIssue("year_inferred")] : [],
    }
  const starts = resolveFacts(
    facts
      .filter((fact) => fact.value.startDate)
      .map((fact) => ({
        value: fact.value.startDate!,
        evidence: fact.evidence,
      })),
  )
  const ends = resolveFacts(
    facts
      .filter((fact) => fact.value.endDate)
      .map((fact) => ({ value: fact.value.endDate!, evidence: fact.evidence })),
  )
  const durations = resolveFacts(
    facts
      .filter((fact) => fact.value.duration)
      .map((fact) => ({
        value: fact.value.duration!,
        evidence: fact.evidence,
      })),
  )
  const period: Period = {
    ...(starts.status === "established" ? { startDate: starts.value } : {}),
    ...(ends.status === "established" ? { endDate: ends.value } : {}),
    ...(durations.status === "established"
      ? { duration: durations.value }
      : {}),
  }
  const evidence = [...facts.map((fact) => fact.evidence), ...unclearEvidence]
  if (
    [starts, ends, durations].some(
      (field) => field.status === "contradictory",
    ) ||
    (period.startDate && period.endDate && period.startDate > period.endDate) ||
    !durationCompatible(period)
  ) {
    return {
      field: {
        status: "contradictory",
        values: facts.map((fact) => fact.value),
        evidence,
      },
      issues: [
        scanIssue("period_contradiction"),
        ...(inferred ? [scanIssue("year_inferred")] : []),
      ],
    }
  }
  return {
    field: {
      status:
        inferred || unclear || !completePeriod(period)
          ? "to_verify"
          : "established",
      value: period,
      evidence,
    },
    issues: inferred ? [scanIssue("year_inferred")] : [],
  }
}
