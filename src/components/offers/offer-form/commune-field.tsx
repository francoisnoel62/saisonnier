"use client"

import { Loader2Icon, MapPinIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useController, useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  INSEE_CODE,
  offerTextLimits,
  POSTAL_CODE,
  type OfferFormReferentials,
  type OfferFormValues,
} from "@/domain/offer-input"
import { cn } from "@/lib/utils"

import { describedBy, fieldId, SelectField } from "./fields"

// Commune du poste, cherchée dans l'API Découpage administratif (geo.api.gouv.fr) : le département
// s'en déduit. Si le service ne répond pas, la commune se saisit à la main avec son département.

const GEO_API = "https://geo.api.gouv.fr/communes"
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const TIMEOUT_MS = 5000

type Commune = {
  name: string
  inseeCode: string
  postalCodes: string[]
  departmentCode: string
}

type Search =
  | { status: "idle" | "loading" | "error" }
  | { status: "done"; communes: Commune[] }

// Réponse de l'API, vérifiée : seules les communes bien formées d'un département connu sont
// proposées, pour que rien ne puisse être refusé par la base.
function parseCommunes(json: unknown, departmentCodes: Set<string>) {
  if (!Array.isArray(json)) throw new Error("Réponse inattendue de l'API")
  return json.flatMap((item): Commune[] => {
    if (typeof item !== "object" || item === null) return []
    const { nom, code, codesPostaux, codeDepartement } = item as Record<
      string,
      unknown
    >
    if (
      typeof nom !== "string" ||
      !nom.trim() ||
      nom.length > offerTextLimits.communeName ||
      typeof code !== "string" ||
      !INSEE_CODE.test(code) ||
      typeof codeDepartement !== "string" ||
      !departmentCodes.has(codeDepartement) ||
      !code.startsWith(codeDepartement)
    ) {
      return []
    }
    const postalCodes = Array.isArray(codesPostaux)
      ? codesPostaux.filter(
          (postal): postal is string =>
            typeof postal === "string" && POSTAL_CODE.test(postal),
        )
      : []
    return [
      {
        name: nom.trim(),
        inseeCode: code,
        postalCodes,
        departmentCode: codeDepartement,
      },
    ]
  })
}

const communeCount = (count: number) =>
  count === 0
    ? "Aucune commune ne correspond : vérifiez l'orthographe."
    : `${count} commune${count > 1 ? "s" : ""} proposée${count > 1 ? "s" : ""}`

export function CommuneField({
  departments,
}: {
  departments: OfferFormReferentials["departments"]
}) {
  const { control, setValue, getValues } = useFormContext<OfferFormValues>()
  const {
    field: {
      ref: communeRef,
      name: communeField,
      value: communeName,
      onChange: setCommuneName,
      onBlur: onCommuneBlur,
    },
    fieldState,
  } = useController({ control, name: "communeName" })
  const [inseeCode, departmentCode, postalCode] = useWatch({
    control,
    name: ["communeInseeCode", "departmentCode", "postalCode"],
  })

  // Une commune enregistrée sans code INSEE a été saisie à la main.
  const [manual, setManual] = useState(
    () => !!getValues("communeName") && !getValues("communeInseeCode"),
  )
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState<Search>({ status: "idle" })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Codes postaux de la commune choisie, quand elle en a plusieurs.
  const [postalChoices, setPostalChoices] = useState<string[]>([])

  const departmentByCode = useMemo(
    () => new Map(departments.map((d) => [d.code, d])),
    [departments],
  )
  const departmentLabel = (code: string) => {
    const department = departmentByCode.get(code)
    return department ? `${department.name} (${department.code})` : code
  }

  const id = fieldId("communeName")
  const listId = `${id}-options`
  const text = query.trim()
  const searching = !manual && text.length >= MIN_QUERY_LENGTH
  const communes = search.status === "done" ? search.communes : []
  const showList = searching && open && communes.length > 0

  useEffect(() => {
    if (!searching) return
    const controller = new AbortController()
    const debounce = setTimeout(async () => {
      setSearch({ status: "loading" })
      const timeout = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS)
      try {
        const params = new URLSearchParams({
          nom: text,
          fields: "nom,code,codesPostaux,codeDepartement",
          boost: "population",
          limit: "8",
        })
        const response = await fetch(`${GEO_API}?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const found = parseCommunes(
          await response.json(),
          new Set(departmentByCode.keys()),
        )
        setSearch({ status: "done", communes: found })
        setActive(found.length > 0 ? 0 : -1)
      } catch {
        // Une recherche remplacée par une saisie plus récente est abandonnée sans bruit.
        if (
          controller.signal.aborted &&
          controller.signal.reason !== "timeout"
        ) {
          return
        }
        // Le service ne répond pas : la saisie continue à la main.
        setSearch({ status: "error" })
        setManual(true)
        setCommuneName(text)
      } finally {
        clearTimeout(timeout)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(debounce)
      controller.abort()
    }
    // `setCommuneName` est stable ; la recherche ne dépend que du texte saisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, searching, departmentByCode])

  // Après un premier envoi, le formulaire revalide tout à chaque changement (OfferForm).
  const setHidden = (
    name: "communeInseeCode" | "postalCode" | "departmentCode",
    value: string,
  ) => setValue(name, value, { shouldDirty: true })

  function choose(choice: Commune) {
    setHidden("communeInseeCode", choice.inseeCode)
    setHidden("departmentCode", choice.departmentCode)
    setHidden(
      "postalCode",
      choice.postalCodes.length === 1 ? choice.postalCodes[0] : "",
    )
    setPostalChoices(choice.postalCodes.length > 1 ? choice.postalCodes : [])
    setCommuneName(choice.name)
    setQuery("")
    setOpen(false)
    requestAnimationFrame(() =>
      document.getElementById(`${id}-change`)?.focus(),
    )
  }

  // Revient à la recherche, commune effacée.
  function reset() {
    setHidden("communeInseeCode", "")
    setHidden("postalCode", "")
    setHidden("departmentCode", "")
    setCommuneName("")
    setPostalChoices([])
    setManual(false)
    setQuery("")
    setSearch({ status: "idle" })
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (manual) return
    const count = communes.length
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setOpen(true)
        setActive((index) => (count > 0 ? (index + 1) % count : -1))
        break
      case "ArrowUp":
        event.preventDefault()
        setOpen(true)
        setActive((index) => (count > 0 ? (index - 1 + count) % count : -1))
        break
      case "Enter":
        // Entrée choisit la commune, sans envoyer le formulaire.
        event.preventDefault()
        if (showList && active >= 0) choose(communes[active])
        break
      case "Escape":
        setOpen(false)
        break
    }
  }

  // Commune choisie dans la liste : son département et sa région, et de quoi en changer.
  if (inseeCode && communeName) {
    const department = departmentByCode.get(departmentCode)
    return (
      <Field data-invalid={fieldState.invalid}>
        <FieldTitle>Commune</FieldTitle>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPinIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0" id={`${id}-chosen`}>
              <p className="font-medium break-words">
                {postalCode ? `${communeName} (${postalCode})` : communeName}
              </p>
              <p className="text-sm text-muted-foreground">
                {departmentLabel(departmentCode)}
                {department?.regionName && ` · ${department.regionName}`}
              </p>
            </div>
          </div>
          <Button
            id={`${id}-change`}
            ref={communeRef}
            type="button"
            variant="outline"
            onClick={reset}
            aria-describedby={`${id}-chosen`}
          >
            Changer de commune
          </Button>
        </div>
        {postalChoices.length > 0 && (
          <SelectField
            name="postalCode"
            label="Code postal (facultatif)"
            hint="Cette commune a plusieurs codes postaux."
            placeholder="Choisir"
            emptyLabel="Non précisé"
            options={postalChoices.map((code) => ({
              value: code,
              label: code,
            }))}
          />
        )}
        <FieldError id={`${id}-error`} errors={[fieldState.error]} />
      </Field>
    )
  }

  const error =
    fieldState.error && !manual && text
      ? "Choisissez la commune dans la liste proposée."
      : fieldState.error?.message

  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={id}>Commune</FieldLabel>
        <div className="relative">
          <Input
            id={id}
            ref={communeRef}
            name={communeField}
            role={manual ? undefined : "combobox"}
            aria-autocomplete={manual ? undefined : "list"}
            aria-expanded={manual ? undefined : showList}
            aria-controls={manual ? undefined : listId}
            aria-activedescendant={
              showList && active >= 0 ? `${listId}-${active}` : undefined
            }
            autoComplete="off"
            maxLength={offerTextLimits.communeName}
            placeholder={manual ? undefined : "Ex. Chamonix-Mont-Blanc"}
            value={manual ? communeName : query}
            onChange={(event) => {
              if (manual) {
                setCommuneName(event.target.value)
              } else {
                setQuery(event.target.value)
                setOpen(true)
              }
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false)
              onCommuneBlur()
            }}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy("communeName", {
              hint: true,
              error: fieldState.invalid,
            })}
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Communes proposées"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {communes.map((choice, index) => (
                <li
                  key={choice.inseeCode}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // Le champ garde le focus : le clic choisit la commune.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(choice)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-md px-2 py-1.5 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="font-medium">{choice.name}</span>
                  <span className="text-muted-foreground">
                    {departmentLabel(choice.departmentCode)}
                    {choice.postalCodes.length === 1 &&
                      ` · ${choice.postalCodes[0]}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FieldDescription id={`${id}-hint`}>
          {manual
            ? "Le nom de la commune, puis son département."
            : "Tapez les premières lettres, puis choisissez la commune dans la liste : le département s'en déduit."}
        </FieldDescription>
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-muted-foreground empty:hidden"
        >
          {searching && search.status === "loading" && (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Recherche…
            </>
          )}
          {searching &&
            search.status === "done" &&
            communeCount(communes.length)}
          {manual &&
            search.status === "error" &&
            "La recherche des communes ne répond pas : saisissez la commune et choisissez son département."}
        </p>
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>

      {manual && (
        <>
          <SelectField
            name="departmentCode"
            label="Département"
            placeholder="Choisir le département"
            options={departments.map((d) => ({
              value: d.code,
              label: `${d.name} (${d.code})`,
            }))}
          />
          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={reset}
          >
            Rechercher la commune dans la liste
          </Button>
        </>
      )}
    </div>
  )
}
