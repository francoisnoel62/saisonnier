// Réponse à trois états : `unknown` (« Non précisé ») est une valeur à part entière, jamais
// convertie en « Non » ni en booléen (§3, §9).
export const triStates = ["yes", "no", "unknown"] as const
export type TriState = (typeof triStates)[number]

const triLabels: Record<TriState, string> = {
  yes: "Oui",
  no: "Non",
  unknown: "Non précisé",
}

export function triLabel(value: TriState) {
  return triLabels[value]
}
