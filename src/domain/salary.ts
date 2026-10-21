import { site } from "@/config/site"

// Unité de la source, conservée telle quelle : aucune conversion horaire ↔ mensuel (§3).
export const salaryUnits = [
  "hour",
  "day",
  "week",
  "month",
  "season",
  "lump_sum",
] as const
export type SalaryUnit = (typeof salaryUnits)[number]

// Le net et le brut ne se comparent ni ne se convertissent jamais l'un en l'autre (§3, §4).
export const salaryBases = ["net", "gross"] as const
export type SalaryBasis = (typeof salaryBases)[number]

export const salaryBasisLabels: Record<SalaryBasis, string> = {
  net: "net",
  gross: "brut",
}

export const salaryUnitLabels: Record<SalaryUnit, string> = {
  hour: "heure",
  day: "jour",
  week: "semaine",
  month: "mois",
  season: "saison",
  lump_sum: "forfait",
}

// Une rémunération telle que la source la formule : un montant, ou une fourchette, en centimes.
export type SalaryStatement = {
  basis: SalaryBasis
  unit: SalaryUnit
  minCents: number
  maxCents?: number
}

export type SalaryFields = {
  salaryNetMinCents?: number | null
  salaryNetMaxCents?: number | null
  salaryNetUnit?: SalaryUnit | null
  salaryGrossMinCents?: number | null
  salaryGrossMaxCents?: number | null
  salaryGrossUnit?: SalaryUnit | null
}

function statement(
  basis: SalaryBasis,
  minCents: number | null = null,
  maxCents: number | null = null,
  unit: SalaryUnit | null = null,
): SalaryStatement[] {
  if (minCents === null || unit === null) return []
  return [
    maxCents === null
      ? { basis, unit, minCents }
      : { basis, unit, minCents, maxCents },
  ]
}

// 0 à 2 déclarations : le net, puis le brut, chacun dans son unité d'origine.
export function salaryStatements(offer: SalaryFields): SalaryStatement[] {
  return [
    ...statement(
      "net",
      offer.salaryNetMinCents ?? null,
      offer.salaryNetMaxCents ?? null,
      offer.salaryNetUnit ?? null,
    ),
    ...statement(
      "gross",
      offer.salaryGrossMinCents ?? null,
      offer.salaryGrossMaxCents ?? null,
      offer.salaryGrossUnit ?? null,
    ),
  ]
}

// Préférence du §3 : le net mensuel ; sinon le brut disponible ; sinon le net dans son unité
// d'origine. Une offre déclare au plus un brut : « mensuel en priorité » n'a rien à départager.
const displayPriority: ((s: SalaryStatement) => boolean)[] = [
  (s) => s.basis === "net" && s.unit === "month",
  (s) => s.basis === "gross",
  (s) => s.basis === "net",
]

// La déclaration à afficher en premier, sans conversion ; null si aucun salaire n'est indiqué.
export function displayedSalary(offer: SalaryFields): SalaryStatement | null {
  const statements = salaryStatements(offer)
  for (const matches of displayPriority) {
    const found = statements.find(matches)
    if (found) return found
  }
  return null
}

const wholeEuros = new Intl.NumberFormat(site.locale, {
  maximumFractionDigits: 0,
})
const euroCents = new Intl.NumberFormat(site.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// « 1 850 € net / mois (avant impôt) », « 12,50 € brut / heure », « 1 800 – 2 000 € brut / mois ».
// Le net s'entend avant impôt sur le revenu, comme le demande le formulaire de dépôt.
export function formatSalary(s: SalaryStatement) {
  const amounts =
    s.maxCents === undefined || s.maxCents === s.minCents
      ? [s.minCents]
      : [s.minCents, s.maxCents]
  // Une fourchette garde le même nombre de décimales à ses deux bornes.
  const format = amounts.every((cents) => cents % 100 === 0)
    ? wholeEuros
    : euroCents
  const range = amounts.map((cents) => format.format(cents / 100)).join(" – ")
  const unit =
    s.unit === "lump_sum" ? " au forfait" : ` / ${salaryUnitLabels[s.unit]}`
  const tax = s.basis === "net" ? " (avant impôt)" : ""
  // Espace insécable avant « € » : le montant et sa devise restent sur la même ligne.
  return `${range}\u00a0€ ${salaryBasisLabels[s.basis]}${unit}${tax}`
}
