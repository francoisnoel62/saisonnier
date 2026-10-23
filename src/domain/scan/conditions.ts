import type { WorkTime } from "@/domain/offer"
import type { TriState } from "@/domain/tri-state"

import { absent, resolveFacts, type ProposalField } from "./field"
import {
  postingObservations,
  type Evidence,
  type Observation,
} from "./observation"
import { fold, isNegated, textObservations } from "./text"
import { scanIssue } from "./vocabulary"

export type ScanConditions = {
  housing: ProposalField<TriState>
  meals: ProposalField<TriState>
  experienceRequired: ProposalField<TriState>
  drivingLicenceRequired: ProposalField<TriState>
  couplesAccepted: ProposalField<TriState>
  petsAccepted: ProposalField<TriState>
  workTime: ProposalField<WorkTime>
  weeklyHours: ProposalField<number>
}
type TriKey = Exclude<keyof ScanConditions, "workTime" | "weeklyHours">
const patterns: Record<
  TriKey,
  { yes: RegExp; no: RegExp; possible?: RegExp; precision?: string }
> = {
  housing: {
    yes: /\b(?:logement\s+(?:fourni|assure)|loge(?:e|s|es)?)\b/,
    no: /\b(?:(?:non|pas)\s+loge\w*|logement\s+(?:non|pas)\s+(?:fourni|assure)|pas de logement|sans logement)\b/,
    possible:
      /\b(?:logement\s+possible|possibilite\s+(?:de\s+logement|d'etre\s+loge\w*))\b/,
    precision: "Logement possible, à confirmer auprès de l'employeur",
  },
  meals: {
    yes: /\b(?:nourri(?:e|s|es)?|repas\s+(?:fourni\w*|assure\w*))\b/,
    no: /\b(?:(?:non|pas)\s+nourri\w*|repas\s+(?:non|pas)\s+(?:fourni\w*|assure\w*)|pas de repas|sans repas)\b/,
    possible:
      /\b(?:repas\s+possibles?|possibilite\s+(?:de\s+repas|d'etre\s+nourri\w*))\b/,
    precision: "Repas possibles, à confirmer auprès de l'employeur",
  },
  experienceRequired: {
    yes: /\b(?:experience\s+(?:exigee|requise|obligatoire)|\d+\s+ans?\s+d'experience\s+(?:exiges?|requis))\b/,
    no: /\b(?:debutant\w*\s+accept\w*|premiere\s+experience|(?:sans\s+|pas d'|aucune\s+)experience(?:\s+(?:exigee|requise))?|experience\s+non\s+(?:exigee|requise))\b/,
  },
  drivingLicenceRequired: {
    yes: /\bpermis(?:\s+b)?\s+(?:exige|obligatoire|requis)\b/,
    no: /\b(?:permis(?:\s+b)?\s+(?:non\s+(?:exige|requis)|facultatif)|sans\s+permis|pas\s+de\s+permis\s+(?:exige|requis))\b/,
    possible: /\bpermis(?:\s+b)?\s+(?:apprecie|souhaite)\b/,
    precision: "Permis apprécié, à confirmer auprès de l'employeur",
  },
  couplesAccepted: {
    yes: /\bcouples?\s+(?:acceptes?|bienvenus?|autorises?)\b/,
    no: /\bcouples?\s+(?:(?:non|pas)\s+acceptes?|refuses?|interdits?)\b/,
  },
  petsAccepted: {
    yes: /\b(?:animaux|chiens?|chats?)\s+(?:acceptes?|autorises?|bienvenus?)\b/,
    no: /\b(?:(?:animaux|chiens?|chats?)\s+(?:(?:non|pas)\s+(?:acceptes?|autorises?)|refuses?|interdits?)|sans\s+animaux)\b/,
  },
}
export function extractConditions(observations: readonly Observation[]) {
  const fields: ScanConditions = {
    housing: absent(),
    meals: absent(),
    experienceRequired: absent(),
    drivingLicenceRequired: absent(),
    couplesAccepted: absent(),
    petsAccepted: absent(),
    workTime: absent(),
    weeklyHours: absent(),
  }
  const precisions: Partial<Record<TriKey, string>> = {}
  const texts = textObservations(observations, [
    "description",
    "postingText",
    "conditions",
    "profile",
    "organization",
    "practicalInfo",
    "workTime",
    "weeklyHours",
    ...Object.keys(patterns),
  ])
  for (const key of Object.keys(patterns) as TriKey[]) {
    const rule = patterns[key]
    const facts: { value: TriState; evidence: Evidence }[] = []
    let possible = false
    for (const observation of postingObservations(observations)) {
      if (
        observation.field === key &&
        ["yes", "no", "unknown"].includes(String(observation.value))
      )
        facts.push({
          value: observation.value as TriState,
          evidence: observation.evidence,
        })
    }
    for (const observation of texts) {
      const text = fold(observation.value).replace(/[·()]/g, "")
      const possibleMatch = rule.possible?.exec(text)
      if (
        possibleMatch &&
        !isNegated(text, possibleMatch.index, possibleMatch[0].length)
      ) {
        possible = true
        facts.push({ value: "unknown", evidence: observation.evidence })
      }
      for (const match of text.matchAll(new RegExp(rule.no.source, "g"))) {
        // Une négation externe de la mention négative (« pas non logé ») ne prouve rien.
        if (!isNegated(text, match.index, 0))
          facts.push({ value: "no", evidence: observation.evidence })
      }
      for (const match of text.matchAll(new RegExp(rule.yes.source, "g"))) {
        const overlapsPossible =
          possibleMatch &&
          match.index >= possibleMatch.index &&
          match.index < possibleMatch.index + possibleMatch[0].length
        if (!overlapsPossible && !isNegated(text, match.index, match[0].length))
          facts.push({ value: "yes", evidence: observation.evidence })
      }
    }
    const resolved = resolveFacts(facts)
    // « possible » reste inconnu, sans devenir une affirmation positive.
    fields[key] =
      resolved.status === "established" && resolved.value === "unknown"
        ? { ...resolved, status: "to_verify" }
        : resolved
    if (possible && rule.precision) precisions[key] = rule.precision
  }
  const workFacts: { value: WorkTime; evidence: Evidence }[] = []
  const hourFacts: { value: number; evidence: Evidence }[] = []
  for (const observation of postingObservations(observations)) {
    if (
      observation.field === "workTime" &&
      (observation.value === "full_time" || observation.value === "part_time")
    )
      workFacts.push({
        value: observation.value,
        evidence: observation.evidence,
      })
    if (
      observation.field === "weeklyHours" &&
      typeof observation.value === "number" &&
      observation.value > 0 &&
      observation.value <= 168
    )
      hourFacts.push({
        value: observation.value,
        evidence: observation.evidence,
      })
  }
  for (const observation of texts) {
    const text = fold(observation.value)
    for (const match of text.matchAll(/\btemps\s+(plein|partiel)\b/g))
      if (!isNegated(text, match.index, match[0].length))
        workFacts.push({
          value: match[1] === "plein" ? "full_time" : "part_time",
          evidence: observation.evidence,
        })
    for (const match of text.matchAll(
      /\b(\d{1,3}(?:[,.]\d+)?)\s*(?:h|heures?)\b(?:\s*(?:\/|par)\s*(jour|semaine|mois))?/g,
    )) {
      const value = +match[1].replace(",", ".")
      const explicitWeekly =
        match[2] === "semaine" ||
        /^\s*(?:hebdomadaires?|hebdo)\b/.test(
          text.slice(match.index + match[0].length),
        )
      if (
        value > 0 &&
        value <= 168 &&
        (value > 24 || explicitWeekly) &&
        match[2] !== "jour" &&
        match[2] !== "mois" &&
        !isNegated(text, match.index, match[0].length)
      )
        hourFacts.push({ value, evidence: observation.evidence })
    }
  }
  fields.workTime = resolveFacts(workFacts)
  fields.weeklyHours = resolveFacts(hourFacts)
  const fieldsToConfirm = (
    Object.keys(fields) as (keyof ScanConditions)[]
  ).filter((key) => fields[key].status === "contradictory")
  return {
    fields,
    precisions,
    fieldsToConfirm,
    issues: fieldsToConfirm.map((key) =>
      scanIssue("optional_contradiction", key),
    ),
  }
}
