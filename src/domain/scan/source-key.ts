import { scanSourceKeyPattern } from "./source"

// Clé stable d'une nouvelle source, déduite de son libellé : minuscules sans accents, tirets,
// une lettre en tête, 48 caractères au plus, suffixe -2, -3… si elle est déjà prise (une clé
// archivée n'est jamais réattribuée : elle reste dans `taken`).
// Segments d'URL de l'admin qui ne peuvent pas devenir une clé (/admin/scan/sources/nouvelle).
export const reservedSourceKeys = ["nouvelle"] as const

export function sourceKeyFromLabel(label: string, taken: Iterable<string>) {
  let base = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!/^[a-z]/.test(base)) base = base ? `source-${base}` : "source"
  base = base.slice(0, 44).replace(/-+$/, "")
  if (base.length < 2) base = "source"
  const used = new Set<string>([...taken, ...reservedSourceKeys])
  let key = base
  for (let index = 2; used.has(key); index++) key = `${base}-${index}`
  if (!scanSourceKeyPattern.test(key)) throw new RangeError("Clé invalide")
  return key
}
