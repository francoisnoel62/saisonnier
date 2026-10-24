"use client"

import { Controller, useFormContext } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "@/components/ui/field"
import { confirmableFieldLabels } from "@/domain/field-certainty"
import type { AdminOfferFormValues } from "@/domain/offer-input"

export function CertaintyFields() {
  const { control } = useFormContext<AdminOfferFormValues>()
  return (
    <Controller
      control={control}
      name="fieldsToConfirm"
      render={({ field }) =>
        field.value?.length ? (
          <FieldSet>
            <FieldLegend>À confirmer</FieldLegend>
            <FieldDescription>
              Décochez une mention pour la retirer. Renseigner une valeur lève
              aussi l&apos;incertitude.
            </FieldDescription>
            {field.value.map((name) => (
              <Field key={name} orientation="horizontal">
                <Checkbox
                  id={`confirmer-${name}`}
                  checked
                  onCheckedChange={() =>
                    field.onChange(
                      field.value?.filter((value) => value !== name),
                    )
                  }
                />
                <FieldLabel htmlFor={`confirmer-${name}`}>
                  {confirmableFieldLabels[name]}
                </FieldLabel>
              </Field>
            ))}
          </FieldSet>
        ) : (
          <></>
        )
      }
    />
  )
}
