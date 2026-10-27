"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { unstable_rethrow, useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { adapterCatalog } from "@/domain/scan/adapter-catalog"
import {
  franceTravailEmissionLabels,
  franceTravailEmissions,
  franceTravailSortLabels,
  franceTravailSorts,
  partnerOffersWarning,
} from "@/domain/scan/france-travail-search"
import { scanLimits } from "@/domain/scan/limits"
import {
  formValuesToSnapshot,
  scanSourceFormSchema,
  sourceTextLimits,
  type SourceFormValues,
} from "@/domain/scan/source-form"
import {
  scanAdapterKinds,
  scanSourceKindLabels,
  type ScanSourceKind,
  type ScanSourceStatus,
} from "@/domain/scan/vocabulary"
import {
  transitionScanSourceAction,
  updateScanSourceAction,
} from "@/server/scan/sources/actions"

import { useSourceTest } from "./source-test"

const fieldId = (name: string) => `source-${name.replace(/\./g, "-")}`

function TextInput({
  name,
  label,
  hint,
  multiline = false,
  maxLength,
  type,
  inputMode,
}: {
  name: FieldPath<SourceFormValues>
  label: string
  hint?: string
  multiline?: boolean
  maxLength?: number
} & Pick<React.ComponentProps<"input">, "type" | "inputMode">) {
  const { control } = useFormContext<SourceFormValues>()
  const id = fieldId(name)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const props = {
          id,
          name: field.name,
          ref: field.ref,
          value: (field.value as string | undefined) ?? "",
          onChange: field.onChange,
          onBlur: field.onBlur,
          maxLength,
          "aria-invalid": fieldState.invalid,
          "aria-describedby":
            [hint && `${id}-hint`, fieldState.invalid && `${id}-error`]
              .filter(Boolean)
              .join(" ") || undefined,
        }
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {multiline ? (
              <Textarea {...props} />
            ) : (
              <Input
                {...props}
                type={type}
                inputMode={inputMode}
                autoComplete="off"
              />
            )}
            {hint && (
              <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
            )}
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  )
}

function AdapterFields({ testOrigin }: { testOrigin?: string }) {
  const { control } = useFormContext<SourceFormValues>()
  const [kind, adapter, partners] = useWatch({
    control,
    name: ["kind", "adapter", "search.offresPartenaires"],
  })
  const options = scanAdapterKinds.filter(
    (value) =>
      adapterCatalog[value].sourceKinds.includes(kind) &&
      (value !== "fixture" || testOrigin),
  )
  const descriptor = adapter ? adapterCatalog[adapter] : null
  return (
    <>
      <Controller
        control={control}
        name="adapter"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fieldId("adapter")}>Connecteur</FieldLabel>
            <Select
              value={field.value || "none"}
              onValueChange={(value) =>
                field.onChange(value === "none" ? "" : value)
              }
            >
              <SelectTrigger
                id={fieldId("adapter")}
                className="w-full sm:w-80"
                aria-describedby={`${fieldId("adapter")}-hint`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">À déterminer</SelectItem>
                {options.map((value) => (
                  <SelectItem key={value} value={value}>
                    {adapterCatalog[value].label}
                    {adapterCatalog[value].availability === "unavailable" &&
                      " (indisponible)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription id={`${fieldId("adapter")}-hint`}>
              {descriptor
                ? (descriptor.unavailableReason ?? descriptor.help)
                : "Un format inconnu reste un développement : enregistrez la source sans connecteur."}
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {(adapter === "teamtailor" || adapter === "factorial") && (
        <TextInput
          name="portalUrl"
          label="Adresse du portail"
          type="url"
          hint="Seule l’origine est conservée (ex. https://recrute.exemple.fr)."
        />
      )}
      {adapter === "fixture" && (
        <TextInput
          name="fixtureOrigin"
          label="Origine de test"
          hint={testOrigin ? `Origine disponible : ${testOrigin}` : undefined}
        />
      )}
      {adapter === "france-travail" && (
        <FieldSet>
          <FieldLegend>Recherche France Travail</FieldLegend>
          <FieldDescription>
            Filtres de la recherche publique ; l’adresse est reconstruite, la
            pagination reste au connecteur.
          </FieldDescription>
          <TextInput name="search.motsCles" label="Mots-clés (facultatif)" />
          <TextInput
            name="search.domaine"
            label="Domaine professionnel"
            hint="Lettre ROME, par exemple G (hôtellerie, restauration, tourisme)."
          />
          <TextInput
            name="search.typeContrat"
            label="Types de contrat"
            hint="Codes séparés par des virgules, par exemple SAI."
          />
          <TextInput
            name="search.lieux"
            label="Lieux"
            hint="99100 (France), 74D (département), 84R (région) ou code INSEE."
          />
          <TextInput
            name="search.rayon"
            label="Rayon (km)"
            inputMode="numeric"
          />
          <ChoiceField
            name="search.emission"
            label="Date de création"
            options={franceTravailEmissions.map((value) => ({
              value,
              label: franceTravailEmissionLabels[value],
            }))}
          />
          <ChoiceField
            name="search.tri"
            label="Tri"
            options={franceTravailSorts.map((value) => ({
              value,
              label: franceTravailSortLabels[value],
            }))}
          />
          <Controller
            control={control}
            name="search.offresPartenaires"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id={fieldId("search.offresPartenaires")}
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                />
                <FieldLabel htmlFor={fieldId("search.offresPartenaires")}>
                  Inclure les offres partenaires
                </FieldLabel>
              </Field>
            )}
          />
          {partners && <FormAlert>{partnerOffersWarning}</FormAlert>}
        </FieldSet>
      )}
      {(!adapter || !descriptor?.derive) && (
        <>
          <TextInput
            name="manualHosts"
            label="Hôtes officiels"
            multiline
            hint="Un hôte par ligne, en minuscules, sans port ni chemin. Un hôte appartient à une seule source."
          />
          <TextInput
            name="manualListUrls"
            label="Pages de liste (documentation)"
            multiline
            hint="Une adresse https par ligne."
          />
        </>
      )}
    </>
  )
}

function ChoiceField({
  name,
  label,
  options,
}: {
  name: "search.emission" | "search.tri"
  label: string
  options: { value: string; label: string }[]
}) {
  const { control } = useFormContext<SourceFormValues>()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
          <Select
            value={field.value || "none"}
            onValueChange={(value) =>
              field.onChange(value === "none" ? "" : value)
            }
          >
            <SelectTrigger id={fieldId(name)} className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non précisé</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function DerivedPreview() {
  const { control } = useFormContext<SourceFormValues>()
  const values = useWatch({ control }) as SourceFormValues
  const snapshot = formValuesToSnapshot(values)
  if (!snapshot.listUrls && !snapshot.postingUrlPattern) return null
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Déduit par le connecteur</p>
      <p className="wrap-anywhere">
        Listes : {snapshot.listUrls?.join(", ") ?? "—"}
      </p>
      <p className="wrap-anywhere">
        Motif des fiches : <code>{snapshot.postingUrlPattern ?? "—"}</code>
      </p>
      <p className="wrap-anywhere">
        Hôtes officiels : {snapshot.officialHosts?.join(", ") ?? "—"}
      </p>
    </div>
  )
}

function PlaceAliases() {
  const { control } = useFormContext<SourceFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: "placeAliases",
  })
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Lieux connus</legend>
      {fields.map((field, index) => (
        <fieldset
          key={field.id}
          className="flex flex-col gap-4 rounded-lg border p-4"
        >
          <legend className="px-1 text-sm font-medium">
            Lieu connu {index + 1}
          </legend>
          <TextInput
            name={`placeAliases.${index}.name`}
            label="Nom lu sur la source"
          />
          <TextInput
            name={`placeAliases.${index}.communeName`}
            label="Commune"
          />
          <TextInput
            name={`placeAliases.${index}.departmentCode`}
            label="Département"
          />
          <TextInput
            name={`placeAliases.${index}.inseeCode`}
            label="Code INSEE"
          />
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => remove(index)}
          >
            Retirer le lieu {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() =>
          append({
            name: "",
            inseeCode: "",
            communeName: "",
            departmentCode: "",
          })
        }
      >
        Ajouter un lieu connu
      </Button>
    </fieldset>
  )
}

// Formulaire complet d'une source (§11.5). « Tester ces réglages » échantillonne les valeurs
// saisies ; « Enregistrer » transmet ce test. Envoi par onSubmit + startTransition (listes Radix).
export function SourceForm({
  source,
  defaultValues,
  today,
  testOrigin,
}: {
  source: {
    key: string
    label: string
    version: number
    status: ScanSourceStatus
    kind: ScanSourceKind
  }
  defaultValues: SourceFormValues
  today: string
  testOrigin?: string
}) {
  const router = useRouter()
  const resolver = useMemo(
    () =>
      zodResolver(
        scanSourceFormSchema({ today, testSourceUrl: testOrigin }),
        undefined,
        {
          raw: true,
        },
      ),
    [today, testOrigin],
  )
  const form = useForm<SourceFormValues>({ resolver, defaultValues })
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [needsTest, setNeedsTest] = useState(false)
  // Échantillon réussi des valeurs saisies, transmis à l'enregistrement (D4).
  const [testId, setTestId] = useState<string | undefined>(undefined)
  const test = useSourceTest(source)
  const kind = useWatch({ control: form.control, name: "kind" })

  function applyFieldErrors(errors: Record<string, string[]>) {
    const paths = Object.keys(errors) as FieldPath<SourceFormValues>[]
    for (const path of paths) form.setError(path, { message: errors[path][0] })
    if (paths.length) form.setFocus(paths[0])
  }
  function save(values: SourceFormValues, { toDraft = false } = {}) {
    setFormError(null)
    startTransition(async () => {
      try {
        let version = source.version
        if (toDraft) {
          const moved = await transitionScanSourceAction(
            source.key,
            source.version,
            "back_to_draft",
          )
          if (!moved.ok) {
            setFormError(moved.message)
            return
          }
          version = moved.version
        }
        const result = await updateScanSourceAction(
          source.key,
          version,
          values,
          testId,
        )
        if (result.ok) {
          toast.success("Modifications enregistrées.")
          router.push(`/admin/scan/sources/${source.key}?onglet=historique`)
          return
        }
        setNeedsTest("reason" in result && result.reason === "needs_test")
        if ("fieldErrors" in result && result.fieldErrors)
          applyFieldErrors(result.fieldErrors)
        setFormError(result.message)
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "L’enregistrement n’a pas abouti. Vérifiez votre connexion : votre saisie est conservée.",
        )
      }
    })
  }
  const onSubmit = form.handleSubmit((values) => save(values))

  return (
    <FormProvider {...form}>
      <form
        className="flex min-w-0 flex-col gap-6"
        onSubmit={onSubmit}
        noValidate
      >
        <Section title="Identité">
          <TextInput
            name="label"
            label="Libellé"
            maxLength={sourceTextLimits.label}
          />
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend variant="label">Type</FieldLegend>
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  {(["employer", "discovery"] as const).map((value) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={value}
                        id={`source-kind-${value}`}
                      />
                      <Label htmlFor={`source-kind-${value}`}>
                        {scanSourceKindLabels[value]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <FieldDescription>
                  Un job-board n’est qu’une découverte : jamais d’employeur
                  affecté, jamais de publication automatique.
                </FieldDescription>
              </FieldSet>
            )}
          />
          {kind === "employer" && (
            <>
              <TextInput
                name="employerName"
                label="Employeur"
                maxLength={sourceTextLimits.employerName}
              />
              <TextInput
                name="employerSiren"
                label="SIREN (conseillé)"
                inputMode="numeric"
              />
              <TextInput
                name="employerWebsite"
                label="Site officiel de l’employeur"
                type="url"
              />
            </>
          )}
        </Section>
        <Section
          title="Connecteur et paramètres"
          description="Les listes lues, le motif des fiches et les hôtes officiels sont déduits par le connecteur : aucune expression régulière à saisir."
        >
          <AdapterFields testOrigin={testOrigin} />
          <DerivedPreview />
        </Section>
        <Section
          title="Lecture"
          description="Les limites d’une source ne peuvent que resserrer les réglages globaux."
        >
          <TextInput
            name="maxListPages"
            label={`Pages de liste (au plus ${scanLimits.maxListPages})`}
            inputMode="numeric"
          />
          <TextInput
            name="maxPostings"
            label={`Fiches par passage (au plus ${scanLimits.maxPostings})`}
            inputMode="numeric"
          />
          <TextInput
            name="minIntervalMs"
            label={`Délai entre deux requêtes, en ms (au moins ${scanLimits.minIntervalMs})`}
            inputMode="numeric"
          />
        </Section>
        <Section
          title="Lieux connus"
          description="Nom lu sur la source → commune vérifiée (ex. une station rattachée à sa commune)."
        >
          <PlaceAliases />
        </Section>
        <Section
          title="Preuves et conditions"
          description="Une lecture autorisée par robots.txt ne vaut pas autorisation de republier."
        >
          <TextInput
            name="affiliationUrl"
            label="Preuve de rattachement : page consultée"
            type="url"
          />
          <TextInput
            name="affiliationNote"
            label="Ce que montre cette page"
            multiline
          />
          <TextInput
            name="affiliationCheckedAt"
            label="Consultée le"
            type="date"
          />
          <TextInput
            name="reuseUrl"
            label="Conditions : CGU ou mentions consultées"
            type="url"
          />
          <TextInput
            name="reuseRobotsExcerpt"
            label="Extrait de robots.txt"
            multiline
          />
          <TextInput name="reuseNote" label="Résumé des conditions" multiline />
          <TextInput name="reuseCheckedAt" label="Consultées le" type="date" />
        </Section>
        <Section title="Motif de la modification">
          <TextInput
            name="note"
            label="Motif"
            multiline
            maxLength={sourceTextLimits.note}
            hint="Obligatoire pour l’identité d’une source prête."
          />
        </Section>
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-fit"
            disabled={pending || test.pending}
            onClick={(event) =>
              test.run("sample", event.currentTarget, {
                values: form.getValues(),
                onDone: (outcome) => {
                  setTestId(outcome.succeeded ? outcome.testId : undefined)
                  if (outcome.succeeded) setNeedsTest(false)
                },
                onFieldErrors: applyFieldErrors,
              })
            }
          >
            Tester ces réglages
          </Button>
          <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
            Enregistrer
          </Button>
          {needsTest && source.status === "ready" && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-fit"
              disabled={pending}
              onClick={form.handleSubmit((values) =>
                save(values, { toDraft: true }),
              )}
            >
              Repasser en brouillon et enregistrer
            </Button>
          )}
        </div>
        {test.sheet}
      </form>
    </FormProvider>
  )
}
