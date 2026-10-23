import { postingObservations, type Observation } from "./observation"

export function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[\u00a0\u202f]/g, " ")
    .toLowerCase()
}
export function textObservations(
  observations: readonly Observation[],
  fields?: readonly string[],
) {
  return postingObservations(observations).filter(
    (observation): observation is Observation<string> =>
      typeof observation.value === "string" &&
      (!fields || fields.includes(observation.field)),
  )
}
// Les indices des regex portent sur le texte neutralisé. Retrouver l'offset brut
// conserve exactement les accents (y compris décomposés) dans les extraits.
export function originalOffset(text: string, foldedIndex: number) {
  let foldedLength = 0,
    offset = 0
  for (const character of text) {
    const length = fold(character).length
    if (foldedLength + length > foldedIndex) return offset
    foldedLength += length
    offset += character.length
  }
  return text.length
}
// La négation est locale à la proposition et ne fuit pas au-delà de « mais », d'un
// point ou d'un point-virgule. « non seulement » n'est pas une négation.
export function isNegated(text: string, index: number, length: number) {
  const before =
    fold(text.slice(0, index))
      .split(/[,.;!?\n]|\bmais\b/)
      .at(-1) ?? ""
  const after = fold(text.slice(index + length)).split(/[,.;!?\n]|\bmais\b/)[0]
  return (
    /(?:\b(?:pas|non|sans|aucun|aucune|ni)\b(?! seulement)|\b(?:n'est|ne sont|n'etant)\b).{0,45}$/.test(
      before,
    ) ||
    /^\s+(?:n'est\s+pas|ne sont\s+pas|non\s+(?:fourni|assure|exige|propose)|pas\s+(?:fourni|assure|exige|propose))\b/.test(
      after,
    )
  )
}
export function positiveMatches(text: string, pattern: RegExp) {
  return [...fold(text).matchAll(new RegExp(pattern.source, "g"))].filter(
    (match) => !isNegated(fold(text), match.index, match[0].length),
  )
}
export const jobTextFields = [
  "title",
  "description",
  "postingText",
  "contract",
  "period",
  "season",
  "conditions",
  "profile",
  "organization",
  "practicalInfo",
  "missions",
  "additionalInfo",
] as const
