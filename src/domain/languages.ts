// Langues proposées au filtre « Langues que je parle » (H6) et, au plan 14, aux langues exigées
// d'une annonce : une seule liste, sinon une langue exigée ne pourrait jamais être cochée.
// Codes ISO 639-1, ceux de la colonne `offers.languages`.
export const languageLabels: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  de: "Allemand",
  es: "Espagnol",
  it: "Italien",
  nl: "Néerlandais",
  pt: "Portugais",
  ru: "Russe",
  zh: "Chinois",
  ja: "Japonais",
  ar: "Arabe",
}

export const languageCodes = Object.keys(languageLabels)

// Le code lui-même si la langue n'est pas dans la liste : rien n'est masqué.
export function languageLabel(code: string) {
  return Object.hasOwn(languageLabels, code) ? languageLabels[code] : code
}
