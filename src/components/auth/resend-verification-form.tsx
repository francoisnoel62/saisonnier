"use client"

import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

type ResendState = { message?: string; sent?: boolean; email?: string }

export function ResendVerificationForm({
  defaultEmail,
}: {
  defaultEmail?: string
}) {
  const [state, formAction, pending] = useActionState(
    async (_: ResendState, formData: FormData): Promise<ResendState> => {
      const email = String(formData.get("email") ?? "").trim()
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/apres-connexion",
      })
      if (error) return { message: authErrorMessage(error), email }
      return { sent: true, email }
    },
    { email: defaultEmail },
  )

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}
        {/* Même réponse que le compte existe ou non : rien n'est révélé. */}
        {state.sent && (
          <FormAlert variant="success">
            Si un compte non vérifié correspond à cette adresse, un nouveau lien
            vient de lui être envoyé.
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
          <SubmitButton pending={pending}>Renvoyer le lien</SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
