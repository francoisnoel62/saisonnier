import { fold } from "./text"

const frenchTools = new Set(
  "le la les un une des du de d et ou pour par avec dans sur au aux en nous vous votre vos notre nos ce cette ces qui que est sont etre a l se ses son sa il elle ils elles ne pas plus sans tout tous comme dont chez recherche poste contrat saisonnier saisonniere".split(
    " ",
  ),
)
const foreignTools = new Set(
  "the and with for your you our are is to of in on we this that job looking der die das und mit fur ein eine wir sie ist von zu im den des als bei".split(
    " ",
  ),
)
export function isFrenchText(text: string): boolean {
  const words = fold(text).match(/[a-z]+/g) ?? []
  if (!words.length) return false
  const french = words.filter((word) => frenchTools.has(word)).length
  const foreign = words.filter((word) => foreignTools.has(word)).length
  return french >= 2 && french / words.length >= 0.08 && french > foreign
}
export function departmentFromPostalCode(code: string): string | null {
  if (!/^\d{5}$/.test(code)) return null
  const prefix = code.slice(0, 2)
  if (prefix === "97" || prefix === "98")
    return /^(?:97[1-8]|984|98[6-8])$/.test(code.slice(0, 3))
      ? code.slice(0, 3)
      : null
  return +prefix >= 1 && +prefix <= 95 ? prefix : null
}
// null = pays absent, jamais une preuve de localisation en France.
export function isFrance(place: {
  country?: string
  countryCode?: string
}): boolean | null {
  const country = fold(place.countryCode?.trim() || place.country?.trim() || "")
  if (!country) return null
  return ["fr", "fra", "france", "republique francaise"].includes(country)
}
