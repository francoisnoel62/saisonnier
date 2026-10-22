import { z } from "zod"

// Métiers du référentiel (§4), gérés par l'admin (plan 15). Un métier désactivé disparaît des
// formulaires et des filtres, mais reste affiché sur les annonces qui le citent.

export const occupationLimits = { label: 100, family: 60 } as const

// Identifiant d'URL du filtre `metier` : « Chef / cheffe de rang » → "chef-cheffe-de-rang". Il ne
// change plus une fois créé, pour que les recherches partagées restent valables.
export function occupationSlug(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "")
}

const requiredText = (max: number, empty: string, tooLong: string) =>
  z.string().trim().min(1, empty).max(max, tooLong)

export const occupationSchema = z.object({
  label: requiredText(
    occupationLimits.label,
    "Indiquez l'intitulé du métier.",
    `L'intitulé ne doit pas dépasser ${occupationLimits.label} caractères.`,
  ).refine(
    (value) => occupationSlug(value) !== "",
    "L'intitulé doit contenir au moins une lettre ou un chiffre.",
  ),
  family: requiredText(
    occupationLimits.family,
    "Indiquez la famille du métier.",
    `La famille ne doit pas dépasser ${occupationLimits.family} caractères.`,
  ),
})

export type OccupationInput = z.infer<typeof occupationSchema>

// Ordre du référentiel après avoir déplacé un métier d'un cran : les identifiants, dans l'ordre.
// Le premier ne monte pas, le dernier ne descend pas.
export function moveInOrder(
  ids: readonly string[],
  id: string,
  direction: "up" | "down",
) {
  const index = ids.indexOf(id)
  const target = direction === "up" ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= ids.length) return [...ids]
  const order = [...ids]
  ;[order[index], order[target]] = [order[target], order[index]]
  return order
}
