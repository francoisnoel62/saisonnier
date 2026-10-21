"use client"

import { CircleCheckIcon } from "lucide-react"
import Link from "next/link"
import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  contactTopicLabels,
  contactTopics,
  HONEYPOT_FIELD,
  MESSAGE_MAX_LENGTH,
  type ContactTopic,
} from "@/domain/contact"
import type { ContactState } from "@/server/contact/actions"

type Defaults = {
  topic: ContactTopic
  name: string
  email: string
  offerId?: string
}

export function ContactForm({
  action,
  defaults,
}: {
  action: (state: ContactState, formData: FormData) => Promise<ContactState>
  defaults: Defaults
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}
  const values = state.values

  useEffect(() => {
    if (state.sent) toast.success("Message envoyé.")
  }, [state])

  if (state.sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-lg border p-8 text-center"
      >
        <CircleCheckIcon className="size-8 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Message envoyé</h2>
        <p className="text-muted-foreground">
          Merci, le fondateur vous répondra par email dès que possible.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}

        <Field data-invalid={!!errors.topic}>
          <FieldLabel htmlFor="topic">Sujet</FieldLabel>
          <Select
            name="topic"
            required
            defaultValue={values?.topic ?? defaults.topic}
          >
            <SelectTrigger
              id="topic"
              className="w-full"
              aria-invalid={!!errors.topic}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contactTopics.map((topic) => (
                <SelectItem key={topic} value={topic}>
                  {contactTopicLabels[topic]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.topic?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nom et prénom</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            defaultValue={values?.name ?? defaults.name}
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
            defaultValue={values?.email ?? defaults.email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          <FieldError id="email-error">{errors.email?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.companyName}>
          <FieldLabel htmlFor="companyName">Entreprise (facultatif)</FieldLabel>
          <Input
            id="companyName"
            name="companyName"
            autoComplete="organization"
            maxLength={150}
            defaultValue={values?.companyName}
            aria-invalid={!!errors.companyName}
            aria-describedby={
              errors.companyName ? "companyName-error" : undefined
            }
          />
          <FieldError id="companyName-error">
            {errors.companyName?.[0]}
          </FieldError>
        </Field>

        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">Téléphone (facultatif)</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            defaultValue={values?.phone}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          <FieldError id="phone-error">{errors.phone?.[0]}</FieldError>
        </Field>

        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="message">Message</FieldLabel>
          <Textarea
            id="message"
            name="message"
            required
            rows={6}
            maxLength={MESSAGE_MAX_LENGTH}
            defaultValue={values?.message}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : "message-hint"}
          />
          <FieldDescription id="message-hint">
            {MESSAGE_MAX_LENGTH.toLocaleString("fr-FR")} caractères au maximum.
          </FieldDescription>
          <FieldError id="message-error">{errors.message?.[0]}</FieldError>
        </Field>

        {defaults.offerId && (
          <input type="hidden" name="offerId" value={defaults.offerId} />
        )}

        {/* Champ piège : invisible et hors parcours clavier, seuls les robots le remplissent. */}
        <div
          aria-hidden
          className="absolute -left-[9999px] h-0 overflow-hidden"
        >
          <label>
            Ne pas remplir
            <input
              type="text"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        <Field>
          <SubmitButton pending={pending}>Envoyer le message</SubmitButton>
        </Field>
      </FieldGroup>
    </form>
  )
}
