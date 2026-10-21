"use client"

import Link from "next/link"
import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"
import type { SignUpState } from "@/server/auth/actions"

// Le formulaire ne transmet aucun rôle : il est fixé par l'action reçue.
export function SignUpForm({
  action,
}: {
  action: (state: SignUpState, formData: FormData) => Promise<SignUpState>
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nom et prénom</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={state.values?.name}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error">{errors.name?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Adresse email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          <FieldError id="email-error">{errors.email?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "password-error" : "password-hint"
            }
          />
          <FieldDescription id="password-hint">
            Au moins {PASSWORD_MIN_LENGTH} caractères.
          </FieldDescription>
          <FieldError id="password-error">{errors.password?.[0]}</FieldError>
        </Field>

        <Field orientation="horizontal" data-invalid={!!errors.terms}>
          <Checkbox
            id="terms"
            name="terms"
            required
            aria-invalid={!!errors.terms}
            aria-describedby={errors.terms ? "terms-error" : undefined}
          />
          <FieldLabel htmlFor="terms" className="font-normal">
            <span>
              J&apos;accepte les{" "}
              <Link
                href="/cgu"
                className="underline underline-offset-4 hover:text-primary"
              >
                conditions générales d&apos;utilisation
              </Link>
            </span>
          </FieldLabel>
        </Field>
        <FieldError id="terms-error" className="-mt-3">
          {errors.terms?.[0]}
        </FieldError>

        <Field>
          <SubmitButton pending={pending}>Créer mon compte</SubmitButton>
          <FieldDescription className="text-center">
            Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
