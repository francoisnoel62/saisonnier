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
import type {
  ContactDetailsField,
  FormState,
} from "@/server/candidates/dossier-actions"

type Action = (
  state: FormState<ContactDetailsField>,
  formData: FormData,
) => Promise<FormState<ContactDetailsField>>

// Nom, téléphone et ville ; l'email est celui du compte.
export function ContactDetailsForm({
  action,
  defaults,
}: {
  action: Action
  defaults: { name: string; email: string; phone: string; city: string }
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}
  const value = (field: ContactDetailsField) =>
    state.values?.[field] ?? defaults[field]

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.saved && (
          <FormAlert variant="success">Coordonnées enregistrées.</FormAlert>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nom et prénom</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={value("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error">{errors.name?.[0]}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Adresse email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={defaults.email}
            readOnly
            aria-describedby="email-hint"
          />
          <FieldDescription id="email-hint">
            L&rsquo;adresse de votre compte, en lecture seule.
          </FieldDescription>
        </Field>

        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">Téléphone</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            defaultValue={value("phone")}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
          />
          <FieldDescription id="phone-hint">
            Obligatoire pour candidater : les employeurs vous rappellent à ce
            numéro.
          </FieldDescription>
          <FieldError id="phone-error">{errors.phone?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.city}>
          <FieldLabel htmlFor="city">Ville (facultatif)</FieldLabel>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            maxLength={100}
            defaultValue={value("city")}
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? "city-error" : undefined}
          />
          <FieldError id="city-error">{errors.city?.[0]}</FieldError>
        </Field>

        <Field>
          <SubmitButton pending={pending}>
            Enregistrer mes coordonnées
          </SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
