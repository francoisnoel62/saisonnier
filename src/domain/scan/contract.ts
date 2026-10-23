import type { Observation } from "./observation"
import { fold, jobTextFields, positiveMatches, textObservations } from "./text"
import { scanIssue } from "./vocabulary"

export function seasonalContractEvidence(observations: readonly Observation[]) {
  const explicit = [],
    nonSeasonal = [],
    ambiguous = [],
    seasonalMentions = []
  for (const observation of textObservations(observations, jobTextFields)) {
    const text = fold(observation.value)
    const seasonal = positiveMatches(
      text,
      /\b(?:cdd\s+(?:saisonnier\w*|saison)|(?:contrat|emploi|poste)\s+saisonnier\w*)\b/,
    )
    if (
      seasonal.length ||
      (observation.field === "title" &&
        positiveMatches(text, /\bsaisonnier(?:e|es|s)?\b/).length)
    )
      explicit.push(observation.evidence)
    if (positiveMatches(text, /\b(?:cdi|a l'annee|alternance|stage)\b/).length)
      nonSeasonal.push(observation.evidence)
    if (positiveMatches(text, /\bsaisonnier(?:e|es|s)?\b/).length)
      seasonalMentions.push(observation.evidence)
    if (
      positiveMatches(
        text,
        /\b(?:cdd|saison|saisonnier\w*|hiver|ete|estival\w*|hivernal\w*)\b/,
      ).length
    )
      ambiguous.push(observation.evidence)
  }
  const contradictory =
    (explicit.length > 0 || seasonalMentions.length > 0) &&
    nonSeasonal.length > 0
  return {
    status: contradictory
      ? ("ambiguous" as const)
      : explicit.length
        ? ("explicit" as const)
        : nonSeasonal.length
          ? ("not_seasonal" as const)
          : ("ambiguous" as const),
    contradictory,
    evidence: [...explicit, ...nonSeasonal, ...ambiguous],
    issues: contradictory ? [scanIssue("contract_contradiction")] : [],
  }
}
