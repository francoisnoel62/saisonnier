"use client"

import { CircleCheckIcon } from "lucide-react"
import { startTransition, useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  purchaseFormatLabels,
  purchaseFormats,
  SCOPE_DETAILS_MAX_LENGTH,
  SERVICE_MESSAGE_MAX_LENGTH,
  serviceKindDetails,
  serviceKinds,
  serviceScopeLabels,
  serviceScopes,
  type ServiceScope,
} from "@/domain/service-request"
import {
  requestServices,
  type ServiceRequestField,
} from "@/server/services/actions"

export type RequestableOffer = {
  id: string
  title: string
  communeName: string
}

const id = (name: ServiceRequestField) => `prestation-${name}`

function describedBy(name: ServiceRequestField, hint: boolean, error: boolean) {
  return (
    [hint && `${id(name)}-hint`, error && `${id(name)}-error`]
      .filter(Boolean)
      .join(" ") || undefined
  )
}

function RequestForm({
  offers,
  onAgain,
}: {
  offers: RequestableOffer[]
  onAgain: () => void
}) {
  const [state, formAction, pending] = useActionState(requestServices, {})
  const errors = state.fieldErrors ?? {}
  const values = state.values
  const [scope, setScope] = useState<ServiceScope>(
    (values?.scope as ServiceScope | undefined) ??
      (offers.length > 0 ? "offer" : "campaign"),
  )

  useEffect(() => {
    if (state.sent) toast.success("Demande envoyée.")
  }, [state])

  if (state.sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-lg border p-8 text-center"
      >
        <CircleCheckIcon className="size-8 text-primary" aria-hidden />
        <h3 className="text-lg font-semibold">Demande envoyée</h3>
        <p className="max-w-md text-muted-foreground">
          Merci : le fondateur l&rsquo;étudie et vous répond par email avec une
          proposition sur devis. Son suivi apparaît dans « Mes demandes ».
        </p>
        <Button variant="outline" onClick={onAgain}>
          Faire une autre demande
        </Button>
      </div>
    )
  }

  const chosen = new Set(values?.services ?? [])
  const scopeDetailsHint =
    scope === "offer"
      ? "Facultatif : ce que vous attendez sur cette annonce."
      : scope === "campaign"
        ? "Les postes, le nombre de recrutements, la période."
        : "Le nom et la commune de l'établissement, les postes concernés."

  return (
    // Envoi sans `action` : après une erreur, le formulaire n'est pas réinitialisé et garde la
    // saisie, cases cochées comprises.
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => formAction(formData))
      }}
    >
      <FieldGroup>
        {state.message && <FormAlert>{state.message}</FormAlert>}

        <FieldSet data-invalid={!!errors.services}>
          <FieldLegend variant="label">Prestations souhaitées</FieldLegend>
          <FieldDescription id={`${id("services")}-hint`}>
            Cochez une ou plusieurs prestations.
          </FieldDescription>
          <div
            className="flex flex-col gap-3"
            aria-describedby={describedBy("services", true, !!errors.services)}
          >
            {serviceKinds.map((kind) => (
              <Field key={kind} orientation="horizontal">
                <Checkbox
                  id={`${id("services")}-${kind}`}
                  name="services"
                  value={kind}
                  defaultChecked={chosen.has(kind)}
                  aria-invalid={!!errors.services}
                />
                <FieldLabel
                  htmlFor={`${id("services")}-${kind}`}
                  className="font-normal"
                >
                  {serviceKindDetails[kind].label}
                </FieldLabel>
              </Field>
            ))}
          </div>
          <FieldError id={`${id("services")}-error`}>
            {errors.services?.[0]}
          </FieldError>
        </FieldSet>

        <FieldSet data-invalid={!!errors.scope}>
          <FieldLegend id={`${id("scope")}-legend`} variant="label">
            Portée de la demande
          </FieldLegend>
          <RadioGroup
            name="scope"
            value={scope}
            onValueChange={(value) => setScope(value as ServiceScope)}
            aria-labelledby={`${id("scope")}-legend`}
            className="flex flex-col gap-3"
          >
            {serviceScopes.map((value) => (
              <Field key={value} orientation="horizontal">
                <RadioGroupItem
                  id={`${id("scope")}-${value}`}
                  value={value}
                  disabled={value === "offer" && offers.length === 0}
                />
                <FieldLabel
                  htmlFor={`${id("scope")}-${value}`}
                  className="font-normal"
                >
                  {serviceScopeLabels[value]}
                  {value === "offer" &&
                    offers.length === 0 &&
                    " (vous n'avez pas encore d'annonce)"}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          <FieldError>{errors.scope?.[0]}</FieldError>
        </FieldSet>

        {scope === "offer" && (
          <Field data-invalid={!!errors.offerId}>
            <FieldLabel htmlFor={id("offerId")}>Annonce concernée</FieldLabel>
            <Select name="offerId" defaultValue={values?.offerId || undefined}>
              <SelectTrigger
                id={id("offerId")}
                className="w-full"
                aria-invalid={!!errors.offerId}
                aria-describedby={describedBy(
                  "offerId",
                  false,
                  !!errors.offerId,
                )}
              >
                <SelectValue placeholder="Choisir une annonce" />
              </SelectTrigger>
              <SelectContent>
                {offers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.title} · {offer.communeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${id("offerId")}-error`}>
              {errors.offerId?.[0]}
            </FieldError>
          </Field>
        )}

        <Field data-invalid={!!errors.scopeDetails}>
          <FieldLabel htmlFor={id("scopeDetails")}>
            {scope === "offer" ? "Précisions (facultatif)" : "Précisions"}
          </FieldLabel>
          <Textarea
            id={id("scopeDetails")}
            name="scopeDetails"
            rows={3}
            maxLength={SCOPE_DETAILS_MAX_LENGTH}
            defaultValue={values?.scopeDetails}
            aria-invalid={!!errors.scopeDetails}
            aria-describedby={describedBy(
              "scopeDetails",
              true,
              !!errors.scopeDetails,
            )}
          />
          <FieldDescription id={`${id("scopeDetails")}-hint`}>
            {scopeDetailsHint}
          </FieldDescription>
          <FieldError id={`${id("scopeDetails")}-error`}>
            {errors.scopeDetails?.[0]}
          </FieldError>
        </Field>

        <FieldSet data-invalid={!!errors.purchaseFormat}>
          <FieldLegend id={`${id("purchaseFormat")}-legend`} variant="label">
            Formule
          </FieldLegend>
          <FieldDescription id={`${id("purchaseFormat")}-hint`}>
            Les tarifs sont établis sur devis, après échange avec vous.
          </FieldDescription>
          <RadioGroup
            name="purchaseFormat"
            defaultValue={values?.purchaseFormat || undefined}
            aria-labelledby={`${id("purchaseFormat")}-legend`}
            aria-describedby={describedBy(
              "purchaseFormat",
              true,
              !!errors.purchaseFormat,
            )}
            className="flex flex-wrap gap-x-6 gap-y-3"
          >
            {purchaseFormats.map((value) => (
              <Field key={value} orientation="horizontal" className="w-auto">
                <RadioGroupItem
                  id={`${id("purchaseFormat")}-${value}`}
                  value={value}
                  aria-invalid={!!errors.purchaseFormat}
                />
                <FieldLabel
                  htmlFor={`${id("purchaseFormat")}-${value}`}
                  className="font-normal"
                >
                  {purchaseFormatLabels[value]}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          <FieldError id={`${id("purchaseFormat")}-error`}>
            {errors.purchaseFormat?.[0]}
          </FieldError>
        </FieldSet>

        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor={id("message")}>Message (facultatif)</FieldLabel>
          <Textarea
            id={id("message")}
            name="message"
            rows={4}
            maxLength={SERVICE_MESSAGE_MAX_LENGTH}
            defaultValue={values?.message}
            aria-invalid={!!errors.message}
            aria-describedby={describedBy("message", false, !!errors.message)}
          />
          <FieldError id={`${id("message")}-error`}>
            {errors.message?.[0]}
          </FieldError>
        </Field>

        <SubmitButton pending={pending}>Envoyer la demande</SubmitButton>
      </FieldGroup>
    </form>
  )
}

// Après un envoi, « Faire une autre demande » repart d'un formulaire vierge.
export function ServiceRequestForm({ offers }: { offers: RequestableOffer[] }) {
  const [attempt, setAttempt] = useState(0)
  return (
    <RequestForm
      key={attempt}
      offers={offers}
      onAgain={() => setAttempt((count) => count + 1)}
    />
  )
}
