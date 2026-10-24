"use client"

import { useFieldArray, useFormContext } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  emptyExtraLocation,
  offerTextLimits,
  type AdminOfferFormValues,
  type OfferFormReferentials,
} from "@/domain/offer-input"
import { MAX_EXTRA_LOCATIONS } from "@/domain/offer-places"
import { CommuneField } from "./commune-field"
import { TextField } from "./fields"

export function ExtraLocations({
  departments,
}: {
  departments: OfferFormReferentials["departments"]
}) {
  const { control, formState } = useFormContext<AdminOfferFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: "extraLocations",
  })
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 font-medium">Autres lieux du même poste</legend>
      {fields.map((field, index) => (
        <fieldset
          key={field.id}
          className="flex flex-col gap-4 rounded-lg border p-4"
        >
          <legend className="px-1 text-sm font-medium">
            Autre lieu {index + 1}
          </legend>
          <CommuneField
            departments={departments}
            prefix={`extraLocations.${index}.`}
          />
          <TextField
            name={`extraLocations.${index}.locationDetails`}
            label="Précisions sur le lieu (facultatif)"
            maxLength={offerTextLimits.locationDetails}
          />
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => remove(index)}
            aria-label={`Retirer le lieu ${index + 1}`}
          >
            Retirer
          </Button>
        </fieldset>
      ))}
      <FieldError
        errors={[
          formState.errors.extraLocations?.root ??
            formState.errors.extraLocations,
        ]}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={fields.length >= MAX_EXTRA_LOCATIONS}
        onClick={() => append(emptyExtraLocation())}
      >
        Ajouter un lieu
      </Button>
    </fieldset>
  )
}
