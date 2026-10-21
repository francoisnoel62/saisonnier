"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

type ResetPasswordState = {
  message?: string
  mismatch?: boolean
  invalidToken?: boolean
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (
      _: ResetPasswordState,
      formData: FormData,
    ): Promise<ResetPasswordState> => {
      const newPassword = String(formData.get("password") ?? "")
      if (newPassword !== formData.get("confirmation")) {
        return { mismatch: true }
      }

      const { error } = await authClient.resetPassword({ newPassword, token })
      if (error) {
        return {
          message: authErrorMessage(error),
          invalidToken: error.code === "INVALID_TOKEN",
        }
      }
      // Toutes les sessions ont été révoquées : on se reconnecte avec le nouveau mot de passe.
      router.replace("/connexion?reinitialise=1")
      return {}
    },
    {},
  )

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && (
          <FormAlert>
            {state.message}
            {state.invalidToken && (
              <>
                {" "}
                <Link
                  href="/mot-de-passe-oublie"
                  className="font-medium underline underline-offset-4"
                >
                  Demander un nouveau lien
                </Link>
              </>
            )}
          </FormAlert>
        )}

        <Field>
          <FieldLabel htmlFor="password">Nouveau mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            aria-describedby="password-hint"
          />
          <FieldDescription id="password-hint">
            Au moins {PASSWORD_MIN_LENGTH} caractères.
          </FieldDescription>
        </Field>

        <Field data-invalid={!!state.mismatch}>
          <FieldLabel htmlFor="confirmation">
            Confirmer le mot de passe
          </FieldLabel>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!state.mismatch}
            aria-describedby={state.mismatch ? "confirmation-error" : undefined}
          />
          <FieldError id="confirmation-error">
            {state.mismatch && "Les deux mots de passe ne correspondent pas."}
          </FieldError>
        </Field>

        <Field>
          <SubmitButton pending={pending}>
            Enregistrer le mot de passe
          </SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
