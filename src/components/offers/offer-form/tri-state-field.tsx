"use client"

import { triLabel, triStates } from "@/domain/tri-state"

import { RadioField } from "./fields"

export type TriStateFieldName =
  | "housing"
  | "meals"
  | "experienceRequired"
  | "languagesRequired"
  | "drivingLicenseRequired"
  | "couplesWelcome"
  | "petsAllowed"

const options = triStates.map((value) => ({ value, label: triLabel(value) }))

// Oui / Non / Non précisé. La valeur initiale est « Non précisé » : sans réponse de l'employeur,
// l'information n'est ni négative ni confirmée (§3, §9).
export function TriStateField({
  name,
  legend,
  hint,
}: {
  name: TriStateFieldName
  legend: string
  hint?: string
}) {
  return (
    <RadioField name={name} legend={legend} hint={hint} options={options} />
  )
}
