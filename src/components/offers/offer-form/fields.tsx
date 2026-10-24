"use client"

import { CalendarIcon } from "lucide-react"
import { useState } from "react"
import { fr } from "react-day-picker/locale"
import { Controller, useFormContext } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { isIsoDate } from "@/domain/offer-activity"
import { formatIsoDate } from "@/domain/offer-display"
import type {
  AdminOfferFormField,
  AdminOfferFormValues,
} from "@/domain/offer-input"
import { dateFromIso, isoFromDate } from "@/lib/calendar-dates"

// Champs du formulaire d'annonce, reliés à react-hook-form (useFormContext). Chaque champ a son
// libellé, son aide et son erreur, annoncés par aria-describedby. Les champs de l'admin (plan 15)
// s'ajoutent à ceux de l'employeur : le même typage sert aux deux formulaires.

export type TextFieldName = Exclude<
  AdminOfferFormField,
  "seasonalContract" | "languages" | "hideCompanyIdentity" | "fieldsToConfirm"
>

// Identifiant unique sur la page, relié au libellé, à l'aide et à l'erreur.
export const fieldId = (name: string) => `offre-${name}`

export function describedBy(
  name: string,
  { hint, error }: { hint?: boolean; error?: boolean },
) {
  const ids = [
    hint && `${fieldId(name)}-hint`,
    error && `${fieldId(name)}-error`,
  ].filter(Boolean)
  return ids.length > 0 ? ids.join(" ") : undefined
}

export function TextField({
  name,
  label,
  hint,
  multiline = false,
  rows,
  type,
  inputMode,
  autoComplete = "off",
  maxLength,
  className,
}: {
  name: TextFieldName
  label: string
  hint?: string
  multiline?: boolean
  rows?: number
  className?: string
} & Pick<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "autoComplete" | "maxLength"
>) {
  const { control } = useFormContext<AdminOfferFormValues>()
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
          "aria-describedby": describedBy(name, {
            hint: !!hint,
            error: fieldState.invalid,
          }),
        }
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {multiline ? (
              <Textarea {...props} rows={rows} />
            ) : (
              <Input
                {...props}
                type={type}
                inputMode={inputMode}
                autoComplete={autoComplete}
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

export type Option = { value: string; label: string }

// Boutons radio dans un fieldset : la légende nomme le groupe.
export function RadioField({
  name,
  legend,
  hint,
  options,
}: {
  name: TextFieldName
  legend: React.ReactNode
  hint?: string
  options: readonly Option[]
}) {
  const { control } = useFormContext<AdminOfferFormValues>()
  const id = fieldId(name)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend id={`${id}-legend`} variant="label">
            {legend}
          </FieldLegend>
          {hint && (
            <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
          )}
          <RadioGroup
            name={field.name}
            value={(field.value as string | undefined) ?? ""}
            onValueChange={field.onChange}
            aria-labelledby={`${id}-legend`}
            aria-describedby={describedBy(name, {
              hint: !!hint,
              error: fieldState.invalid,
            })}
            className="flex flex-wrap gap-x-6 gap-y-3"
          >
            {options.map((option, index) => (
              <Field
                key={option.value}
                orientation="horizontal"
                className="w-auto"
              >
                <RadioGroupItem
                  ref={index === 0 ? field.ref : undefined}
                  value={option.value}
                  id={`${id}-${option.value}`}
                  aria-invalid={fieldState.invalid}
                />
                <FieldLabel
                  htmlFor={`${id}-${option.value}`}
                  className="font-normal"
                >
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  )
}

// Radix Select n'accepte pas d'option vide : « aucun choix » passe par cette valeur.
const NONE = "__aucun__"

export type OptionGroup = { label: string; options: readonly Option[] }

// Liste déroulante ; `emptyLabel` ajoute une option qui efface le choix.
export function SelectField({
  name,
  label,
  hint,
  placeholder = "Choisir",
  options,
  emptyLabel,
  className,
}: {
  name: TextFieldName
  label: string
  hint?: string
  placeholder?: string
  options: readonly (Option | OptionGroup)[]
  emptyLabel?: string
  className?: string
}) {
  const { control } = useFormContext<AdminOfferFormValues>()
  const id = fieldId(name)
  const item = (option: Option) => (
    <SelectItem key={option.value} value={option.value}>
      {option.label}
    </SelectItem>
  )

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select
            name={field.name}
            value={(field.value as string | undefined) ?? ""}
            onValueChange={(value) =>
              field.onChange(value === NONE ? "" : value)
            }
          >
            <SelectTrigger
              id={id}
              ref={field.ref}
              className="w-full"
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy(name, {
                hint: !!hint,
                error: fieldState.invalid,
              })}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
              {options.map((option) =>
                "options" in option ? (
                  <SelectGroup key={option.label}>
                    <SelectLabel>{option.label}</SelectLabel>
                    {option.options.map(item)}
                  </SelectGroup>
                ) : (
                  item(option)
                ),
              )}
            </SelectContent>
          </Select>
          {hint && (
            <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
          )}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

// Date choisie dans un calendrier (AAAA-MM-JJ). `minDate` grise les jours antérieurs.
export function DateField({
  name,
  label,
  hint,
  minDate,
  clearable = false,
}: {
  name: "startDate" | "endDate" | "applicationDeadline"
  label: string
  hint?: string
  minDate?: string
  clearable?: boolean
}) {
  const { control } = useFormContext<AdminOfferFormValues>()
  const [open, setOpen] = useState(false)
  const id = fieldId(name)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = isIsoDate(field.value) ? field.value : null
        const selected = value ? dateFromIso(value) : undefined
        const earliest = minDate ? dateFromIso(minDate) : undefined
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`${id}-label`} htmlFor={id}>
              {label}
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={id}
                    ref={field.ref}
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal sm:w-64"
                    aria-labelledby={`${id}-label ${id}-value`}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy(name, {
                      hint: !!hint,
                      error: fieldState.invalid,
                    })}
                  >
                    <CalendarIcon data-icon="inline-start" aria-hidden />
                    <span
                      id={`${id}-value`}
                      className={value ? undefined : "text-muted-foreground"}
                    >
                      {value ? formatIsoDate(value) : "Choisir une date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={fr}
                    selected={selected}
                    defaultMonth={selected ?? earliest}
                    disabled={earliest ? { before: earliest } : undefined}
                    onSelect={(date) => {
                      field.onChange(date ? isoFromDate(date) : "")
                      setOpen(false)
                    }}
                    className="[--cell-size:--spacing(9)]"
                  />
                </PopoverContent>
              </Popover>
              {clearable && value && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => field.onChange("")}
                >
                  Effacer<span className="sr-only"> : {label}</span>
                </Button>
              )}
            </div>
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
