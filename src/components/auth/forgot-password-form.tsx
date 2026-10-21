"use client"

import Link from "next/link"
import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

type ForgotPasswordState = { message?: string; sent?: boolean; email?: string }

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (
      _: ForgotPasswordState,
      formData: FormData,
    ): Promise<ForgotPasswordState> => {
      const email = String(formData.get("email") ?? "").trim()
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reinitialiser-mot-de-passe",
      })
      if (error) return { message: authErrorMessage(error), email }
      return { sent: true, email }
    },
    {},
  )

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}
        {/* Même réponse que le compte existe ou non : rien n'est révélé. */}
        {state.sent && (
          <FormAlert variant="success">
            Si un compte correspond à cette adresse, vous allez recevoir un lien
            pour choisir un nouveau mot de passe. Il est valable une heure.
          </FormAlert>
        )}

        <Field>
          <FieldLabel htmlFor="email">Adresse email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
          />
        </Field>

        <Field>
          <SubmitButton pending={pending}>Recevoir le lien</SubmitButton>
          <FieldDescription className="text-center">
            <Link href="/connexion">Retour à la connexion</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
