"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { CompanyDetailsField, FormState } from "@/server/companies/actions"

type Action = (
  state: FormState<CompanyDetailsField>,
  formData: FormData,
) => Promise<FormState<CompanyDetailsField>>

const fields: {
  name: CompanyDetailsField
  label: string
  type: string
  maxLength: number
  autoComplete: string
  hint?: string
}[] = [
  {
    name: "displayName",
    label: "Nom d'usage ou enseigne (facultatif)",
    type: "text",
    maxLength: 150,
    autoComplete: "off",
    hint: "Le nom montré aux candidats, s'il diffère de la raison sociale.",
  },
  {
    name: "website",
    label: "Site web (facultatif)",
    type: "url",
    maxLength: 200,
    autoComplete: "url",
  },
  {
    name: "phone",
    label: "Téléphone professionnel",
    type: "tel",
    maxLength: 30,
    autoComplete: "tel",
  },
]

// Ce que l'employeur modifie lui-même : enseigne, site et téléphone. Le SIREN ne change pas ici.
export function CompanyDetailsForm({
  action,
  defaults,
}: {
  action: Action
  defaults: Record<CompanyDetailsField, string>
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        {state.saved && !state.message && (
          <FormAlert variant="success">Modifications enregistrées.</FormAlert>
        )}
        {state.message && (
          <FormAlert variant={state.saved ? "success" : "error"}>
            {state.message}
          </FormAlert>
        )}

        {fields.map((field) => {
          const error = errors[field.name]?.[0]
          return (
            <Field key={field.name} data-invalid={!!error}>
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                maxLength={field.maxLength}
                autoComplete={field.autoComplete}
                defaultValue={
                  state.values?.[field.name] ?? defaults[field.name]
                }
                aria-invalid={!!error}
                aria-describedby={
                  error
                    ? `${field.name}-error`
                    : field.hint
                      ? `${field.name}-hint`
                      : undefined
                }
              />
              {field.hint && (
                <FieldDescription id={`${field.name}-hint`}>
                  {field.hint}
                </FieldDescription>
              )}
              <FieldError id={`${field.name}-error`}>{error}</FieldError>
            </Field>
          )
        })}

        <Field>
          <SubmitButton pending={pending}>Enregistrer</SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
