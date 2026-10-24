export const confirmableFields = [
  "salary",
  "housing",
  "meals",
  "experience",
  "driving_license",
  "couples",
  "pets",
  "languages",
  "work_time",
] as const
export type ConfirmableField = (typeof confirmableFields)[number]
export const confirmableFieldLabels: Record<ConfirmableField, string> = {
  salary: "Salaire",
  housing: "Logement",
  meals: "Repas",
  experience: "Expérience",
  driving_license: "Permis de conduire",
  couples: "Couples",
  pets: "Animaux",
  languages: "Langues",
  work_time: "Temps de travail",
}
type CertaintyInput = {
  salaryNetMinCents: number | null
  salaryNetMaxCents: number | null
  salaryNetUnit: string | null
  salaryGrossMinCents: number | null
  salaryGrossMaxCents: number | null
  salaryGrossUnit: string | null
  housing: string
  meals: string
  experienceRequired: string
  drivingLicenseRequired: string
  couplesWelcome: string
  petsAllowed: string
  languagesRequired: string
  workTime: string
}
export function isToConfirm(
  offer: { fieldsToConfirm?: readonly string[] },
  field: ConfirmableField,
) {
  return offer.fieldsToConfirm?.includes(field) ?? false
}
// Une valeur concrète saisie par l'admin lève automatiquement l'incertitude.
export function establishFields(
  input: CertaintyInput,
  flags: readonly ConfirmableField[],
): ConfirmableField[] {
  const neutral: Record<ConfirmableField, boolean> = {
    salary: [
      input.salaryNetMinCents,
      input.salaryNetMaxCents,
      input.salaryNetUnit,
      input.salaryGrossMinCents,
      input.salaryGrossMaxCents,
      input.salaryGrossUnit,
    ].every((v) => v === null),
    housing: input.housing === "unknown",
    meals: input.meals === "unknown",
    experience: input.experienceRequired === "unknown",
    driving_license: input.drivingLicenseRequired === "unknown",
    couples: input.couplesWelcome === "unknown",
    pets: input.petsAllowed === "unknown",
    languages: input.languagesRequired === "unknown",
    work_time: input.workTime === "unknown",
  }
  return confirmableFields.filter(
    (field) => flags.includes(field) && neutral[field],
  )
}
