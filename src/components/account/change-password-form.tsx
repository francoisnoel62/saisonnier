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
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

type ChangePasswordState = {
  message?: string
  mismatch?: boolean
  done?: boolean
}

// Passe par l'API Better Auth (/api/auth), dont la limitation de débit s'applique.
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (
      _: ChangePasswordState,
      formData: FormData,
    ): Promise<ChangePasswordState> => {
      const currentPassword = String(formData.get("currentPassword") ?? "")
      const newPassword = String(formData.get("newPassword") ?? "")
      if (newPassword !== formData.get("confirmation")) {
        return { mismatch: true }
      }

      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        return {
          message:
            error.code === "INVALID_PASSWORD"
              ? "Le mot de passe actuel est incorrect."
              : authErrorMessage(error),
        }
      }
      return { done: true }
    },
    {},
  )

  return (
    // La clé remet les champs à zéro après un changement réussi.
    <form action={formAction} key={state.done ? "done" : "editing"}>
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}
        {state.done && (
          <FormAlert variant="success">
            Votre mot de passe a été modifié.
          </FormAlert>
        )}

        <Field>
          <FieldLabel htmlFor="currentPassword">Mot de passe actuel</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="newPassword">Nouveau mot de passe</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            aria-describedby="newPassword-hint"
          />
          <FieldDescription id="newPassword-hint">
            Au moins {PASSWORD_MIN_LENGTH} caractères.
          </FieldDescription>
        </Field>

        <Field data-invalid={!!state.mismatch}>
          <FieldLabel htmlFor="confirmation">
            Confirmer le nouveau mot de passe
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
            Modifier le mot de passe
          </SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
