"use client"

import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { salaryUnitLabels, salaryUnits } from "@/domain/salary"

import { SelectField, TextField } from "./fields"

const unitOptions = salaryUnits.map((unit) => ({
  value: unit,
  label: unit === "lump_sum" ? "Au forfait" : `Par ${salaryUnitLabels[unit]}`,
}))

const bases = [
  { key: "Net", legend: "Salaire net (avant impôt)", noun: "net" },
  { key: "Gross", legend: "Salaire brut", noun: "brut" },
] as const

// Le net et le brut se saisissent séparément, chacun dans son unité : rien n'est converti (§3).
export function SalaryFields() {
  return (
    <>
      {bases.map(({ key, legend, noun }) => (
        <FieldSet key={key}>
          <FieldLegend variant="label">{legend}</FieldLegend>
          <FieldDescription>
            Un montant, ou une fourchette avec son maximum.
          </FieldDescription>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name={`salary${key}Min`}
              label={`Montant ${noun} (€)`}
              inputMode="decimal"
              maxLength={20}
            />
            <TextField
              name={`salary${key}Max`}
              label={`Maximum ${noun} (€, facultatif)`}
              inputMode="decimal"
              maxLength={20}
            />
            <SelectField
              name={`salary${key}Unit`}
              label={`Unité du salaire ${noun}`}
              options={unitOptions}
            />
          </div>
        </FieldSet>
      ))}
    </>
  )
}
