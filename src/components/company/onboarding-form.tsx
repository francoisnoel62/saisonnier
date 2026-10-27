"use client"

import { useActionState, useState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  memberRelationshipLabels,
  memberRelationships,
} from "@/domain/membership"
import type { FormState, OnboardingField } from "@/server/companies/actions"

import { CompanySearch } from "./company-search"
import type {
  CompanySuggestion,
  DirectorySearch,
} from "@/server/companies/directory"

type Action = (
  state: FormState<OnboardingField>,
  formData: FormData,
) => Promise<FormState<OnboardingField>>

type TextField = Exclude<OnboardingField, "certified" | "relationship">

const companyFields = [
  "legalName",
  "siren",
  "siret",
  "nafCode",
  "nafLabel",
  "communeName",
  "displayName",
] as const satisfies TextField[]

const empty: Record<TextField, string> = {
  legalName: "",
  siren: "",
  siret: "",
  nafCode: "",
  nafLabel: "",
  communeName: "",
  displayName: "",
  website: "",
  jobTitle: "",
  relationshipDetails: "",
  phone: "",
}

// Onboarding employeur : l'entreprise (trouvée dans l'annuaire ou saisie à la main), puis le
// lien du déposant avec elle. L'admin vérifie le tout avant toute publication (H2).
export function OnboardingForm({
  action,
  search,
}: {
  action: Action
  search: (query: string) => Promise<DirectorySearch>
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [values, setValues] = useState(empty)
  const [relationship, setRelationship] = useState("")
  const [certified, setCertified] = useState(false)
  const errors = state.fieldErrors ?? {}

  const set = (field: TextField) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }))

  function choose(suggestion: CompanySuggestion) {
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(
        companyFields.map((field) => [field, suggestion[field] ?? ""]),
      ),
    }))
    document.getElementById("legalName")?.focus()
  }

  const text = (
    field: TextField,
    label: string,
    options: {
      hint?: string
      maxLength: number
      type?: string
      autoComplete?: string
      inputMode?: "numeric" | "tel" | "url"
      required?: boolean
    },
  ) => {
    const describedBy = errors[field]
      ? `${field}-error`
      : options.hint
        ? `${field}-hint`
        : undefined
    return (
      <Field data-invalid={!!errors[field]}>
        <FieldLabel htmlFor={field}>{label}</FieldLabel>
        <Input
          id={field}
          name={field}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete ?? "off"}
          inputMode={options.inputMode}
          required={options.required}
          maxLength={options.maxLength}
          value={values[field]}
          onChange={set(field)}
          aria-invalid={!!errors[field]}
          aria-describedby={describedBy}
        />
        {options.hint && (
          <FieldDescription id={`${field}-hint`}>
            {options.hint}
          </FieldDescription>
        )}
        <FieldError id={`${field}-error`}>{errors[field]?.[0]}</FieldError>
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <CompanySearch search={search} onChoose={choose} />

      <form action={formAction} noValidate>
        <FieldGroup>
          {state.message && <FormAlert>{state.message}</FormAlert>}

          <FieldSet>
            <FieldLegend>Votre entreprise</FieldLegend>
            <FieldDescription>
              Pré-remplie par la recherche, ou à saisir à la main.
            </FieldDescription>
            <FieldGroup>
              {text("legalName", "Raison sociale", {
                maxLength: 200,
                autoComplete: "organization",
                required: true,
              })}
              {text("siren", "SIREN", {
                hint: "9 chiffres, sur votre extrait Kbis ou votre avis de situation INSEE.",
                maxLength: 11,
                inputMode: "numeric",
                required: true,
              })}
              {text("siret", "SIRET de l'établissement (facultatif)", {
                maxLength: 17,
                inputMode: "numeric",
              })}
              {text("nafCode", "Code NAF / APE (facultatif)", {
                hint: "Par exemple 55.10Z.",
                maxLength: 10,
              })}
              {text("nafLabel", "Activité principale (facultatif)", {
                maxLength: 200,
              })}
              {text("communeName", "Commune (facultatif)", {
                maxLength: 100,
                autoComplete: "address-level2",
              })}
              {text("displayName", "Nom d'usage ou enseigne (facultatif)", {
                hint: "Le nom que connaissent vos candidats, s'il diffère de la raison sociale.",
                maxLength: 150,
              })}
              {text("website", "Site web (facultatif)", {
                hint: "Il aide à vérifier votre rattachement.",
                type: "url",
                inputMode: "url",
                maxLength: 200,
                autoComplete: "url",
              })}
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Vous et l&rsquo;entreprise</FieldLegend>
            <FieldGroup>
              {text("jobTitle", "Votre fonction", {
                hint: "Par exemple : directrice, chef de cuisine, gérant.",
                maxLength: 100,
                autoComplete: "organization-title",
                required: true,
              })}

              <Field data-invalid={!!errors.relationship}>
                <FieldLabel htmlFor="relationship">
                  Lien avec l&rsquo;entreprise
                </FieldLabel>
                <Select
                  name="relationship"
                  value={relationship}
                  onValueChange={setRelationship}
                >
                  <SelectTrigger
                    id="relationship"
                    className="w-full"
                    aria-invalid={!!errors.relationship}
                    aria-describedby={
                      errors.relationship ? "relationship-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Choisissez" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberRelationships.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "other"
                          ? "Autre (à préciser)"
                          : memberRelationshipLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="relationship-error">
                  {errors.relationship?.[0]}
                </FieldError>
              </Field>

              {relationship === "other" &&
                text("relationshipDetails", "Précisez votre lien", {
                  maxLength: 150,
                  required: true,
                })}

              {text("phone", "Téléphone professionnel", {
                hint: "Nous pouvons vous appeler pour vérifier votre rattachement.",
                type: "tel",
                inputMode: "tel",
                maxLength: 30,
                autoComplete: "tel",
                required: true,
              })}

              <Field orientation="horizontal" data-invalid={!!errors.certified}>
                <Checkbox
                  id="certified"
                  name="certified"
                  checked={certified}
                  onCheckedChange={(checked) => setCertified(checked === true)}
                  aria-invalid={!!errors.certified}
                  aria-describedby={
                    errors.certified ? "certified-error" : undefined
                  }
                />
                <FieldLabel htmlFor="certified" className="font-normal">
                  Je certifie être habilité·e à publier des offres pour cette
                  entreprise
                </FieldLabel>
              </Field>
              <FieldError id="certified-error" className="-mt-4">
                {errors.certified?.[0]}
              </FieldError>
            </FieldGroup>
          </FieldSet>

          <Field>
            <SubmitButton pending={pending}>
              Envoyer pour vérification
            </SubmitButton>
            <FieldDescription>
              Nous vérifions chaque rattachement avant la publication de vos
              annonces.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
