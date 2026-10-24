import { fold } from "./text"

export function normalizeJobTitle(title: string) {
  return fold(title)
    .replace(/\b(?:h\s*[/.-]\s*f(?:\s*[/.-]\s*x)?|f\s*[/.-]\s*h)\b/g, " ")
    .replace(
      /\b(?:saison\s+(?:d'|de\s+)?)?(?:hiver|ete|estival\w*|hivernal\w*)(?:\s+\d{2,4}(?:\s*[-/–—]\s*\d{2,4})?)?\b/g,
      " ",
    )
    .replace(
      /\b(?:(?:en\s+)?(?:cdd|cdi|alternance|stage)|contrat|emploi\s+saisonnier\w*|saisonnier\w*)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}
