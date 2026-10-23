import type { SalaryStatement, SalaryUnit } from "@/domain/salary"

import { absent, established, type ProposalField } from "./field"
import { boundEvidence, type Evidence, type Observation } from "./observation"
import { fold, isNegated, originalOffset, textObservations } from "./text"
import { scanIssue } from "./vocabulary"

function cents(raw: string): number | null {
  if (
    !/^(?:\d+(?:[,.]\d{1,2})?|\d{1,3}(?:[ ,.]\d{3})+(?:[,.]\d{1,2})?)$/.test(
      raw,
    )
  )
    return null
  let text = raw.replace(/\s/g, "")
  const separator = Math.max(text.lastIndexOf(","), text.lastIndexOf("."))
  if (separator >= 0 && text.length - separator <= 3)
    text = `${text.slice(0, separator).replace(/[,.]/g, "")}.${text.slice(separator + 1)}`
  else text = text.replace(/[,.]/g, "")
  const value = Number(text)
  const result = Math.round(value * 100)
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(result)
    ? result
    : null
}
function unitOf(text: string): SalaryUnit | null {
  if (/\bmensuel\w*\b|\bpar\s+mois\b|\/\s*mois\b/.test(text)) return "month"
  if (/\bhoraire\b|\bpar\s+heure\b|\/\s*(?:heure|h)\b/.test(text)) return "hour"
  if (/\bjournalier\w*\b|\bpar\s+jour\b|\/\s*jour\b/.test(text)) return "day"
  if (/\bhebdomadaire\b|\bpar\s+semaine\b|\/\s*semaine\b/.test(text))
    return "week"
  if (/\b(?:par|pour\s+la)\s+saison\b|\/\s*saison\b/.test(text)) return "season"
  if (/\bforfait\b/.test(text)) return "lump_sum"
  const bare =
    /^\s*(?:(?:nets?|bruts?)\s+)?(mois|heure|jour|semaine|saison)(?:\s+(?:nets?|bruts?))?\s*$/.exec(
      text,
    )
  if (bare)
    return (
      {
        mois: "month",
        heure: "hour",
        jour: "day",
        semaine: "week",
        saison: "season",
      } as const
    )[bare[1] as "mois" | "heure" | "jour" | "semaine" | "saison"]
  return null
}
function salaryExcerpt(
  observation: Observation<string>,
  index: number,
  length: number,
) {
  if (observation.field === "salary") return observation.value
  const raw = observation.value
  const start = originalOffset(raw, index),
    end = originalOffset(raw, index + length)
  const boundary = /[;!?\n]|\.(?:\s|$)/g
  const before = [...raw.slice(0, start).matchAll(boundary)].at(-1)
  const after = boundary.exec(raw.slice(end))
  return raw
    .slice(
      before ? before.index + before[0].length : 0,
      after ? end + after.index : raw.length,
    )
    .trim()
}
export function extractSalaryText(observations: readonly Observation[]) {
  const facts: { value: SalaryStatement; evidence: Evidence }[] = []
  const precision: string[] = [],
    evidence: Evidence[] = []
  for (const observation of textObservations(observations, [
    "salary",
    "description",
    "postingText",
    "conditions",
  ])) {
    const original = observation.value
    const text = fold(original)
    const amount = "(\\d(?:[\\d ,.]*\\d)?)"
    const pattern = new RegExp(
      `(?:de\\s+)?${amount}(?:\\s*(?:a|–|-)\\s*${amount})?\\s*(?:€|euros?|eur\\b)`,
      "g",
    )
    const matches = [...text.matchAll(pattern)]
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]
      if (isNegated(text, match.index, match[0].length)) continue
      const excerpt = salaryExcerpt(observation, match.index, match[0].length)
      const proof = boundEvidence({ ...observation.evidence, excerpt })
      const previousEnd = index
        ? matches[index - 1].index + matches[index - 1][0].length
        : 0
      const before =
        text
          .slice(previousEnd, match.index)
          .split(/[;.!?\n]/)
          .at(-1) ?? ""
      const after = text
        .slice(match.index + match[0].length, matches[index + 1]?.index)
        .split(/[;!?\n]|\.(?:\s|$)/)[0]
      const context = /\b(?:nets?|bruts?)\b/.test(after)
        ? after
        : index === 0
          ? before
          : (before.split(/\bet\b/).at(-1) ?? "")
      if (
        observation.field !== "salary" &&
        /\b(?:loyer|caution|frais|prix|tarif)\b/.test(before) &&
        !/\b(?:salaire|remuneration|prime)\b/.test(before)
      )
        continue
      const bases = [...context.matchAll(/\b(net|brut)s?\b/g)].map((m) => m[1])
      const basis =
        bases.length && bases.every((b) => b === bases[0])
          ? bases[0] === "net"
            ? "net"
            : "gross"
          : null
      const unit = unitOf(after) ?? unitOf(context)
      const minCents =
          /[-−.,]/.test(text.charAt(match.index - 1)) && match.index > 0
            ? null
            : cents(match[1]),
        maxCents = match[2] ? cents(match[2]) : undefined
      evidence.push(proof)
      // La précision garde le texte de la source, sans conversion ni requalification.
      precision.push(
        `${excerpt}${!basis ? ", base non précisée par la source" : ""}`,
      )
      if (
        basis &&
        unit &&
        minCents !== null &&
        maxCents !== null &&
        (maxCents === undefined || maxCents >= minCents)
      )
        facts.push({
          value: {
            basis,
            unit,
            minCents,
            ...(maxCents !== undefined ? { maxCents } : {}),
          },
          evidence: proof,
        })
    }
    if (
      !matches.length &&
      (/\bsmic\b/.test(text) || (observation.field === "salary" && text.trim()))
    ) {
      const excerpt =
        observation.field === "salary"
          ? original
          : salaryExcerpt(observation, text.indexOf("smic"), 4)
      precision.push(excerpt)
      evidence.push(boundEvidence({ ...observation.evidence, excerpt }))
    }
  }
  const values = facts
    .map((fact) => fact.value)
    .filter(
      (value, index, all) =>
        all.findIndex(
          (other) =>
            other.basis === value.basis &&
            other.unit === value.unit &&
            other.minCents === value.minCents &&
            (other.maxCents ?? other.minCents) ===
              (value.maxCents ?? value.minCents),
        ) === index,
    )
  const conflicting = values.some((value, index) =>
    values.some(
      (other, otherIndex) =>
        index !== otherIndex &&
        value.basis === other.basis &&
        value.unit === other.unit,
    ),
  )
  const field: ProposalField<SalaryStatement[]> = conflicting
    ? {
        status: "contradictory",
        values: values.map((value) => [value]),
        evidence,
      }
    : values.length
      ? established(values, evidence)
      : absent()
  return {
    field,
    precision: precision.length
      ? established([...new Set(precision)].join("\n"), evidence)
      : absent<string>(),
    issues: conflicting ? [scanIssue("optional_contradiction", "salary")] : [],
  }
}
