"use client"

import { useActionState, useState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { site } from "@/config/site"
import { APPLICATION_MESSAGE_MAX_LENGTH } from "@/domain/candidate-dossier"
import type { FormState } from "@/server/candidates/dossier-actions"

type Action = (
  state: FormState<"applicationMessage">,
  formData: FormData,
) => Promise<FormState<"applicationMessage">>

const count = new Intl.NumberFormat(site.locale)

// Message d'accompagnement : il préremplit le corps des emails de candidature (plan 11).
export function ApplicationMessageForm({
  action,
  defaultMessage,
}: {
  action: Action
  defaultMessage: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [length, setLength] = useState(defaultMessage.length)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.saved && (
          <FormAlert variant="success">Message enregistré.</FormAlert>
        )}
        <Field data-invalid={!!errors.applicationMessage}>
          <FieldLabel htmlFor="applicationMessage">
            Message d&rsquo;accompagnement (facultatif)
          </FieldLabel>
          <Textarea
            id="applicationMessage"
            name="applicationMessage"
            rows={8}
            maxLength={APPLICATION_MESSAGE_MAX_LENGTH}
            defaultValue={state.values?.applicationMessage ?? defaultMessage}
            onChange={(event) => setLength(event.target.value.length)}
            aria-invalid={!!errors.applicationMessage}
            aria-describedby="applicationMessage-hint applicationMessage-count"
          />
          <FieldDescription id="applicationMessage-hint">
            Il préremplit vos emails de candidature ; vous pourrez le modifier
            avant chaque envoi.
          </FieldDescription>
          <p
            id="applicationMessage-count"
            className="text-sm text-muted-foreground tabular-nums"
          >
            {count.format(length)} /{" "}
            {count.format(APPLICATION_MESSAGE_MAX_LENGTH)} caractères
          </p>
          <FieldError>{errors.applicationMessage?.[0]}</FieldError>
        </Field>
        <Field>
          <SubmitButton pending={pending}>Enregistrer le message</SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
