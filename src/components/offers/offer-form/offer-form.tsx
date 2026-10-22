"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { unstable_rethrow, useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import {
  OfferPreview,
  OfferPreviewSheet,
} from "@/components/offers/offer-preview"
import { draftOfferPreview } from "@/components/offers/offer-preview-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { languageCodes, languageLabel } from "@/domain/languages"
import { seasons, workTimes } from "@/domain/offer"
import { todayInParis } from "@/domain/offer-activity"
import { seasonLabels, workTimeLabels } from "@/domain/offer-display"
import {
  emptyOfferFormValues,
  offerInputContext,
  offerInputSchema,
  offerTextLimits,
  publicationInputOf,
  type OfferFormField,
  type OfferFormReferentials,
  type OfferFormValues,
} from "@/domain/offer-input"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import type { OfferFormResult } from "@/server/offers/employer-actions"

import { CommuneField } from "./commune-field"
import {
  DateField,
  describedBy,
  fieldId,
  RadioField,
  SelectField,
  TextField,
} from "./fields"
import { PublicationMinimum } from "./publication-minimum"
import { SalaryFields } from "./salary-fields"
import { TriStateField } from "./tri-state-field"

type Company = { id: string; legalName: string; displayName: string | null }

export type OfferFormAction = (
  values: OfferFormValues,
) => Promise<OfferFormResult>

// Ordre des champs dans le formulaire : la première erreur renvoyée par le serveur prend le focus.
const fieldOrder = Object.keys(emptyOfferFormValues()) as OfferFormField[]

function Section({
  number,
  title,
  required = false,
  description,
  children,
}: {
  number: number
  title: string
  required?: boolean
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <h2>
            {number}. {title}
          </h2>
          <Badge variant={required ? "secondary" : "outline"}>
            {required ? "Obligatoire" : "Facultatif"}
          </Badge>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  )
}

function SeasonalContractField() {
  const { control } = useFormContext<OfferFormValues>()
  const id = fieldId("seasonalContract")
  return (
    <Controller
      control={control}
      name="seasonalContract"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <Field orientation="horizontal">
            <Checkbox
              id={id}
              ref={field.ref}
              name={field.name}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy("seasonalContract", {
                hint: true,
                error: fieldState.invalid,
              })}
            />
            <FieldLabel htmlFor={id} className="font-normal">
              Il s&rsquo;agit d&rsquo;un contrat saisonnier
            </FieldLabel>
          </Field>
          <FieldDescription id={`${id}-hint`}>
            Seuls les contrats explicitement saisonniers, pour l&rsquo;été ou
            l&rsquo;hiver, sont publiés.
          </FieldDescription>
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

// Les langues se cochent quand la réponse à « Langues exigées » est « Oui » (H6).
function LanguagesField() {
  const { control } = useFormContext<OfferFormValues>()
  const required = useWatch({ control, name: "languagesRequired" })
  const id = fieldId("languages")
  if (required !== "yes") return null

  return (
    <Controller
      control={control}
      name="languages"
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">
            Langues exigées : lesquelles ?
          </FieldLegend>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            aria-describedby={fieldState.invalid ? `${id}-error` : undefined}
          >
            {languageCodes.map((code, index) => (
              <Field key={code} orientation="horizontal">
                <Checkbox
                  id={`${id}-${code}`}
                  ref={index === 0 ? field.ref : undefined}
                  checked={field.value.includes(code)}
                  onCheckedChange={(checked) =>
                    field.onChange(
                      checked === true
                        ? [...field.value, code]
                        : field.value.filter((item) => item !== code),
                    )
                  }
                  aria-invalid={fieldState.invalid}
                />
                <FieldLabel htmlFor={`${id}-${code}`} className="font-normal">
                  {languageLabel(code)}
                </FieldLabel>
              </Field>
            ))}
          </div>
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  )
}

function PeriodFields({ today }: { today: string }) {
  const { control } = useFormContext<OfferFormValues>()
  const [kind, startDate] = useWatch({
    control,
    name: ["periodKind", "startDate"],
  })

  if (kind === "dates") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <DateField name="startDate" label="Date de début" />
        <DateField
          name="endDate"
          label="Date de fin"
          minDate={startDate && startDate > today ? startDate : today}
        />
      </div>
    )
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <TextField
          name="durationValue"
          label="Durée"
          inputMode="numeric"
          maxLength={3}
        />
        <SelectField
          name="durationUnit"
          label="Unité de durée"
          options={[
            { value: "weeks", label: "Semaines" },
            { value: "months", label: "Mois" },
          ]}
        />
      </div>
      <DateField
        name="startDate"
        label="Date de début (facultatif)"
        hint="Sans date de fin : la durée est indiquée à partir de cette date."
        clearable
      />
    </>
  )
}

// Encart du minimum, recalculé à chaque saisie.
function LiveMinimum({
  companyId,
  blockedDomains,
}: {
  companyId: string
  blockedDomains: readonly string[]
}) {
  const { control } = useFormContext<OfferFormValues>()
  // Sans nom de champ, useWatch renvoie toutes les valeurs, valeurs initiales comprises.
  const values = useWatch({ control }) as OfferFormValues
  const { missing } = checkPublicationMinimum(
    publicationInputOf(values, companyId),
    { origin: "deposited", blockedDomains },
  )
  return <PublicationMinimum missing={missing} />
}

// Aperçu candidat de la saisie, calculé à l'ouverture du panneau.
function DraftPreview({
  referentials,
  company,
}: {
  referentials: OfferFormReferentials
  company: Company
}) {
  const { getValues } = useFormContext<OfferFormValues>()
  const values = getValues()
  const { missing } = checkPublicationMinimum(
    publicationInputOf(values, company.id),
    { origin: "deposited", blockedDomains: referentials.blockedDomains },
  )
  return (
    <OfferPreview
      preview={draftOfferPreview(values, referentials, company)}
      missing={missing.map((item) => item.label)}
    />
  )
}

// Formulaire structuré du dépôt (§3, §6) : le minimum de publication, puis tout ce qui est
// facultatif. Le même schéma valide la saisie ici et dans la Server Action.
export function OfferForm({
  mode,
  action,
  defaultValues,
  referentials,
  company,
  publishesDirectly,
}: {
  mode: "create" | "edit"
  action: OfferFormAction
  defaultValues: OfferFormValues
  referentials: OfferFormReferentials
  company: Company
  // Déposant vérifié : l'annonce créée est publiée aussitôt (H2).
  publishesDirectly: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const today = useMemo(() => todayInParis(new Date()), [])
  const schema = useMemo(
    () => offerInputSchema(offerInputContext(referentials, today)),
    [referentials, today],
  )
  const form = useForm<OfferFormValues>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues,
  })

  // Après un premier envoi, toutes les erreurs suivent la saisie : une règle qui lie plusieurs
  // champs (email ou téléphone, par exemple) se met à jour quel que soit le champ modifié.
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ isSubmitted }) => {
          if (isSubmitted) void form.trigger()
        },
      }),
    [form],
  )

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      let result: OfferFormResult
      try {
        result = await action(values)
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez : votre saisie est conservée.",
        )
        return
      }

      if (!result.ok) {
        const errors = result.fieldErrors ?? {}
        const fields = fieldOrder.filter((field) => errors[field]?.length)
        for (const field of fields) {
          form.setError(field, { message: errors[field]![0] })
        }
        if (fields.length > 0) form.setFocus(fields[0])
        setFormError(
          result.message ??
            (fields.length > 0 ? "Corrigez les champs signalés." : null),
        )
        return
      }

      if (mode === "edit") {
        toast.success("Modifications enregistrées.")
      } else if (result.status === "published") {
        toast.success("Annonce publiée : elle est visible des candidats.")
      } else {
        toast.success(
          "Annonce enregistrée : elle sera publiée après la vérification de votre rattachement.",
        )
      }
      router.push("/employeur/annonces")
    })
  })

  const submitLabel =
    mode === "edit"
      ? "Enregistrer les modifications"
      : publishesDirectly
        ? "Publier l'annonce"
        : "Enregistrer l'annonce"

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Section number={1} title="Poste" required>
            <TextField
              name="title"
              label="Intitulé du poste"
              hint="Par exemple : Serveur / serveuse, Moniteur de ski."
              maxLength={offerTextLimits.title}
            />
            <SelectField
              name="occupationId"
              label="Métier (facultatif)"
              hint="Il permet aux candidats de trouver l'annonce par métier."
              placeholder="Choisir un métier"
              emptyLabel="Aucun"
              options={groupByFamily(referentials.occupations)}
            />
            <TextField
              name="description"
              label="Description (facultatif)"
              hint="L'établissement, l'équipe, ce qui rend le poste intéressant."
              multiline
              rows={6}
              maxLength={offerTextLimits.description}
            />
            <TextField
              name="missions"
              label="Missions (facultatif)"
              multiline
              rows={4}
              maxLength={offerTextLimits.missions}
            />
          </Section>

          <Section number={2} title="Contrat" required>
            <SeasonalContractField />
            <RadioField
              name="season"
              legend="Saison"
              options={seasons.map((season) => ({
                value: season,
                label: seasonLabels[season],
              }))}
            />
            <RadioField
              name="periodKind"
              legend="Période du contrat"
              options={[
                { value: "dates", label: "Dates de début et de fin" },
                { value: "duration", label: "Une durée" },
              ]}
            />
            <PeriodFields today={today} />
            <DateField
              name="applicationDeadline"
              label="Date limite de candidature (facultatif)"
              hint="Passée cette date, l'annonce est retirée des résultats."
              minDate={today}
              clearable
            />
          </Section>

          <Section number={3} title="Lieu" required>
            <CommuneField departments={referentials.departments} />
            <TextField
              name="locationDetails"
              label="Précisions sur le lieu (facultatif)"
              hint="Station, lieu-dit, établissement."
              maxLength={offerTextLimits.locationDetails}
            />
          </Section>

          <Section
            number={4}
            title="Rémunération"
            description="Si vous le connaissez, indiquez le salaire net mensuel avant impôt : c'est celui que les candidats comparent. Le brut, s'il est indiqué, reste distinct."
          >
            <SalaryFields />
            <TextField
              name="salaryNotes"
              label="Précisions sur la rémunération (facultatif)"
              hint="Pourboires, primes, heures supplémentaires…"
              multiline
              rows={2}
              maxLength={offerTextLimits.salaryNotes}
            />
          </Section>

          <Section number={5} title="Conditions">
            <TriStateField name="housing" legend="Logement fourni" />
            <TextField
              name="housingDetails"
              label="Conditions du logement (facultatif)"
              hint="Chambre individuelle ou partagée, participation demandée…"
              multiline
              rows={2}
              maxLength={offerTextLimits.details}
            />
            <TriStateField name="meals" legend="Repas fournis" />
            <TextField
              name="mealsDetails"
              label="Conditions des repas (facultatif)"
              multiline
              rows={2}
              maxLength={offerTextLimits.details}
            />
          </Section>

          <Section number={6} title="Profil">
            <TriStateField
              name="experienceRequired"
              legend="Expérience exigée"
            />
            <TextField
              name="experienceDetails"
              label="Précisions sur l'expérience (facultatif)"
              maxLength={offerTextLimits.details}
            />
            <TriStateField name="languagesRequired" legend="Langues exigées" />
            <LanguagesField />
            <TriStateField
              name="drivingLicenseRequired"
              legend="Permis de conduire exigé"
            />
            <TextField
              name="drivingLicenseDetails"
              label="Précisions sur le permis (facultatif)"
              maxLength={offerTextLimits.details}
            />
          </Section>

          <Section number={7} title="Organisation">
            <RadioField
              name="workTime"
              legend="Temps de travail"
              options={workTimes.map((workTime) => ({
                value: workTime,
                label: workTimeLabels[workTime],
              }))}
            />
            <TextField
              name="weeklyHours"
              label="Heures par semaine (facultatif)"
              hint="Par exemple 35 ou 37,5."
              inputMode="decimal"
              maxLength={5}
              className="sm:max-w-48"
            />
            <TextField
              name="scheduleDetails"
              label="Horaires (facultatif)"
              hint="Coupures, travail de nuit, jours de repos…"
              multiline
              rows={2}
              maxLength={offerTextLimits.details}
            />
          </Section>

          <Section number={8} title="Vie pratique">
            <TriStateField name="couplesWelcome" legend="Couples acceptés" />
            <TriStateField name="petsAllowed" legend="Animaux acceptés" />
            <TextField
              name="otherConstraints"
              label="Autres contraintes pratiques (facultatif)"
              hint="Uniquement celles que vous pouvez documenter : accès, tenue, vaccinations…"
              multiline
              rows={3}
              maxLength={offerTextLimits.otherConstraints}
            />
          </Section>

          <Section
            number={9}
            title="Candidature"
            required
            description="Au moins un email ou un téléphone : les candidats vous contactent directement. Les adresses et liens des job-boards (Indeed, LinkedIn…) ne sont pas acceptés."
          >
            <TextField
              name="applyEmail"
              label="Email de candidature"
              type="email"
              autoComplete="email"
              maxLength={offerTextLimits.applyEmail}
            />
            <TextField
              name="applyPhone"
              label="Téléphone de candidature"
              type="tel"
              autoComplete="tel"
              maxLength={offerTextLimits.applyPhone}
            />
            <TextField
              name="applyUrl"
              label="Lien officiel de candidature (facultatif)"
              hint="La page emploi de votre site ou de votre portail de recrutement."
              type="url"
              inputMode="url"
              maxLength={offerTextLimits.applyUrl}
            />
          </Section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <LiveMinimum
            companyId={company.id}
            blockedDomains={referentials.blockedDomains}
          />
          <OfferPreviewSheet
            trigger={
              <Button type="button" variant="outline">
                <EyeIcon data-icon="inline-start" aria-hidden />
                Aperçu candidat
              </Button>
            }
          >
            <DraftPreview referentials={referentials} company={company} />
          </OfferPreviewSheet>
          {formError && <FormAlert>{formError}</FormAlert>}
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
          {!publishesDirectly && mode === "create" && (
            <p className="text-sm text-muted-foreground">
              Votre rattachement est en cours de vérification : l&rsquo;annonce
              sera publiée dès sa validation.
            </p>
          )}
          <Button asChild variant="ghost">
            <Link href="/employeur/annonces">Annuler</Link>
          </Button>
        </aside>
      </form>
    </FormProvider>
  )
}

function groupByFamily(occupations: OfferFormReferentials["occupations"]) {
  const groups = new Map<string, { value: string; label: string }[]>()
  for (const occupation of occupations) {
    const group = groups.get(occupation.family) ?? []
    group.push({ value: occupation.id, label: occupation.label })
    groups.set(occupation.family, group)
  }
  return [...groups].map(([label, options]) => ({ label, options }))
}
