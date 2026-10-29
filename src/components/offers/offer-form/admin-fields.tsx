"use client"

import { BuildingIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { unstable_rethrow } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { CompanySearch } from "@/components/company/company-search"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CompanyFile } from "@/domain/membership"
import { originLabels } from "@/domain/offer-display"
import {
  adminOfferTextLimits,
  type AdminOfferFormValues,
} from "@/domain/offer-input"
import type { CompanyOption } from "@/server/companies/companies"
import type { CompanySuggestion } from "@/server/companies/directory"
import {
  createCompanyFileAction,
  searchCompanyFileAction,
} from "@/server/offers/admin-actions"

import { describedBy, fieldId, RadioField, TextField } from "./fields"

// Champs du back-office (plan 15) : origine et entreprise de l'annonce, source d'une annonce
// collectée, canal de candidature et anonymat (§6, §7).

export function companyLabel(company: CompanyOption) {
  const name = company.displayName
    ? `${company.displayName} (${company.legalName})`
    : company.legalName
  return company.siren ? `${name} · SIREN ${company.siren}` : name
}

// Entreprise de l'annonce : choisie parmi les fiches existantes, ou créée sans compte.
function CompanyField({
  companies,
  onCreated,
}: {
  companies: CompanyOption[]
  onCreated: (company: CompanyOption) => void
}) {
  const { control } = useFormContext<AdminOfferFormValues>()
  const [open, setOpen] = useState(false)
  const id = fieldId("companyId")

  return (
    <Controller
      control={control}
      name="companyId"
      render={({ field, fieldState }) => {
        const selected = companies.find((company) => company.id === field.value)
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`${id}-label`} htmlFor={id}>
              Entreprise
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={id}
                    ref={field.ref}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-labelledby={`${id}-label ${id}-value`}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy("companyId", {
                      hint: true,
                      error: fieldState.invalid,
                    })}
                    className="h-auto min-h-9 min-w-0 flex-1 basis-64 justify-between py-2 font-normal"
                  >
                    <span
                      id={`${id}-value`}
                      className={
                        selected
                          ? "text-left break-words whitespace-normal"
                          : "text-muted-foreground"
                      }
                    >
                      {selected
                        ? companyLabel(selected)
                        : "Choisir une entreprise"}
                    </span>
                    <ChevronsUpDownIcon
                      className="text-muted-foreground"
                      aria-hidden
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-(--radix-popover-trigger-width) min-w-72 p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput
                      placeholder="Raison sociale, enseigne ou SIREN"
                      aria-label="Rechercher une entreprise"
                    />
                    <CommandList>
                      <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
                      <CommandGroup>
                        {companies.map((company) => (
                          <CommandItem
                            key={company.id}
                            value={`${companyLabel(company)} ${company.id}`}
                            data-checked={company.id === field.value}
                            onSelect={() => {
                              field.onChange(company.id)
                              setOpen(false)
                            }}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="break-words">
                                {company.displayName ?? company.legalName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {[
                                  company.displayName && company.legalName,
                                  company.siren && `SIREN ${company.siren}`,
                                  company.communeName,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <CompanyFileDialog
                onCreated={(company) => {
                  onCreated(company)
                  field.onChange(company.id)
                }}
              />
            </div>
            <FieldDescription id={`${id}-hint`}>
              L&rsquo;entreprise reste connue du service, même si son identité
              est masquée aux candidats.
            </FieldDescription>
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

type CompanyFileField = keyof CompanyFile

const emptyFile: Record<CompanyFileField, string> = {
  legalName: "",
  siren: "",
  siret: "",
  nafCode: "",
  nafLabel: "",
  communeName: "",
  displayName: "",
  website: "",
}

// Ce que l'annuaire remplit, comme à l'onboarding employeur ; le site reste à saisir.
const directoryFields = [
  "legalName",
  "siren",
  "siret",
  "nafCode",
  "nafLabel",
  "communeName",
  "displayName",
] as const satisfies CompanyFileField[]

const fileFields: {
  name: CompanyFileField
  label: string
  hint?: string
  maxLength: number
  inputMode?: "numeric" | "url"
}[] = [
  { name: "legalName", label: "Raison sociale", maxLength: 200 },
  {
    name: "siren",
    label: "SIREN (facultatif)",
    hint: "Une entreprise déjà connue par son SIREN est reprise telle quelle.",
    maxLength: 11,
    inputMode: "numeric",
  },
  {
    name: "siret",
    label: "SIRET de l'établissement (facultatif)",
    maxLength: 17,
    inputMode: "numeric",
  },
  {
    name: "nafCode",
    label: "Code NAF / APE (facultatif)",
    hint: "Par exemple 55.10Z.",
    maxLength: 10,
  },
  {
    name: "nafLabel",
    label: "Activité principale (facultatif)",
    maxLength: 200,
  },
  { name: "communeName", label: "Commune (facultatif)", maxLength: 100 },
  {
    name: "displayName",
    label: "Enseigne (facultatif)",
    hint: "Le nom montré aux candidats, s'il diffère de la raison sociale.",
    maxLength: 150,
  },
  {
    name: "website",
    label: "Site web (facultatif)",
    maxLength: 200,
    inputMode: "url",
  },
]

// Fiche d'une entreprise sans compte, pré-remplie par l'annuaire des entreprises comme à
// l'onboarding employeur, ou saisie à la main. Le panneau est rendu hors du formulaire de
// l'annonce : ses envois, recherche comprise, ne doivent pas remonter jusqu'à lui.
function CompanyFileDialog({
  onCreated,
}: {
  onCreated: (company: CompanyOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(emptyFile)
  const [errors, setErrors] = useState<
    Partial<Record<CompanyFileField, string[]>>
  >({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(suggestion: CompanySuggestion) {
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(
        directoryFields.map((field) => [field, suggestion[field] ?? ""]),
      ),
    }))
    setErrors({})
    document.getElementById("fiche-legalName")?.focus()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await createCompanyFileAction(values)
        if (!result.ok) {
          setErrors(result.fieldErrors)
          return
        }
        onCreated(result.company)
        toast.success(
          result.existing
            ? "Entreprise déjà connue : elle est sélectionnée."
            : "Fiche entreprise créée.",
        )
        setValues(emptyFile)
        setErrors({})
        setOpen(false)
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "La fiche n'a pas été créée. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PlusIcon data-icon="inline-start" aria-hidden />
          Créer une fiche entreprise
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle fiche entreprise</DialogTitle>
          <DialogDescription>
            Pour une entreprise sans compte : son annonce collectée ou transmise
            s&rsquo;y rattache.
          </DialogDescription>
        </DialogHeader>
        <CompanySearch
          search={searchCompanyFileAction}
          onChoose={choose}
          title="Rechercher dans l'annuaire des entreprises"
          unavailable="La recherche est momentanément indisponible : saisissez la fiche à la main."
        />
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldGroup>
            {fileFields.map(({ name, label, hint, maxLength, inputMode }) => {
              const id = `fiche-${name}`
              const error = errors[name]?.[0]
              return (
                <Field key={name} data-invalid={!!error}>
                  <FieldLabel htmlFor={id}>{label}</FieldLabel>
                  <Input
                    id={id}
                    value={values[name]}
                    maxLength={maxLength}
                    inputMode={inputMode}
                    autoComplete="off"
                    onChange={(event) =>
                      setValues({ ...values, [name]: event.target.value })
                    }
                    aria-invalid={!!error}
                    aria-describedby={
                      [hint && `${id}-hint`, error && `${id}-error`]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                  {hint && (
                    <FieldDescription id={`${id}-hint`}>
                      {hint}
                    </FieldDescription>
                  )}
                  <FieldError id={`${id}-error`}>{error}</FieldError>
                </Field>
              )
            })}
          </FieldGroup>
          {formError && <FormAlert>{formError}</FormAlert>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              Créer la fiche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Section « Origine et entreprise ». Une annonce modifiée garde son origine ; déposée, elle
// garde aussi son entreprise, celle de son employeur.
export function AdminOriginFields({
  companies: initialCompanies,
  originLocked,
  companyLocked,
}: {
  companies: CompanyOption[]
  originLocked: boolean
  companyLocked: boolean
}) {
  const { control } = useFormContext<AdminOfferFormValues>()
  const [origin, companyId] = useWatch({
    control,
    name: ["origin", "companyId"],
  })
  const [companies, setCompanies] = useState(initialCompanies)
  const company = companies.find((item) => item.id === companyId)

  return (
    <>
      {originLocked ? (
        <Field>
          <FieldTitle>Origine</FieldTitle>
          <p>{originLabels[origin]}</p>
        </Field>
      ) : (
        <RadioField
          name="origin"
          legend="Origine de l'annonce"
          options={[
            {
              value: "collected",
              label: "Collectée sur le site officiel de l'employeur",
            },
            { value: "deposited", label: "Transmise par l'employeur" },
          ]}
        />
      )}

      {companyLocked ? (
        <Field>
          <FieldTitle>Entreprise</FieldTitle>
          <p className="flex items-start gap-2">
            <BuildingIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {company ? companyLabel(company) : "—"}
          </p>
          <FieldDescription>
            Une annonce déposée reste celle de l&rsquo;entreprise de son
            employeur.
          </FieldDescription>
        </Field>
      ) : (
        <CompanyField
          companies={companies}
          onCreated={(created) =>
            setCompanies((list) =>
              list.some((item) => item.id === created.id)
                ? list
                : [...list, created],
            )
          }
        />
      )}

      {origin === "collected" && (
        <>
          <TextField
            name="sourceUrl"
            label="Lien de l'annonce sur le site officiel"
            hint="La page de l'annonce sur le site ou le portail de recrutement de l'employeur, jamais un job-board."
            type="url"
            inputMode="url"
            maxLength={adminOfferTextLimits.sourceUrl}
          />
          <TextField
            name="sourceName"
            label="Nom de la source"
            hint="Par exemple « Site carrières de l'Hôtel du Lac »."
            maxLength={adminOfferTextLimits.sourceName}
          />
          <p className="text-sm text-muted-foreground">
            Vérifiez cette page officielle avant de valider les informations de
            l&rsquo;annonce.
          </p>
        </>
      )}
    </>
  )
}

// Canal de candidature (§7) : l'employeur directement, ou un chargé de recrutement du service,
// qui seul permet de masquer l'identité de l'entreprise.
export function AdminApplicationFields() {
  const { control, setValue } = useFormContext<AdminOfferFormValues>()
  const channel = useWatch({ control, name: "applicationChannel" })
  const recruiter = channel === "recruiter"
  const id = fieldId("hideCompanyIdentity")

  // Sans intermédiation, l'anonymat n'existe pas.
  useEffect(() => {
    if (!recruiter) setValue("hideCompanyIdentity", false)
  }, [recruiter, setValue])

  return (
    <>
      <RadioField
        name="applicationChannel"
        legend="Qui reçoit les candidatures ?"
        options={[
          { value: "employer", label: "L'employeur, directement" },
          { value: "recruiter", label: "Un chargé de recrutement du service" },
        ]}
      />
      {recruiter && (
        <TextField
          name="recruiterName"
          label="Nom du chargé de recrutement"
          hint="La personne du service qui reçoit les candidatures. Ses coordonnées vont dans les champs ci-dessous."
          maxLength={adminOfferTextLimits.recruiterName}
        />
      )}
      <Controller
        control={control}
        name="hideCompanyIdentity"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} data-disabled={!recruiter}>
            <Field orientation="horizontal">
              <Checkbox
                id={id}
                ref={field.ref}
                name={field.name}
                checked={field.value}
                disabled={!recruiter}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy("hideCompanyIdentity", {
                  hint: true,
                  error: fieldState.invalid,
                })}
              />
              <FieldLabel htmlFor={id} className="font-normal">
                Masquer l&rsquo;identité de l&rsquo;entreprise
              </FieldLabel>
            </Field>
            <FieldDescription id={`${id}-hint`}>
              Les candidats voient « Entreprise confidentielle ». Possible
              seulement quand le service assure l&rsquo;intermédiation.
            </FieldDescription>
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )}
      />
    </>
  )
}
