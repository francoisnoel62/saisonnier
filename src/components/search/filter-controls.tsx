"use client"

import { debounce } from "nuqs"
import { useId } from "react"
import { fr } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { languageCodes, languageLabel } from "@/domain/languages"
import { formatIsoDate } from "@/domain/offer-display"
import { salaryBasisLabels, type SalaryBasis } from "@/domain/salary"
import {
  searchSwitchLabels,
  type SearchReferentials,
  type SearchSwitch,
} from "@/domain/search-chips"
import type { SearchWorkTime } from "@/domain/search-criteria"
import { dateFromIso, isoFromDate } from "@/lib/calendar-dates"

import { useSearch } from "./search-provider"

// Contrôles des filtres de /offres. Chacun lit et écrit l'URL par useSearch : le même contrôle
// sert dans la barre (popover) et dans le panneau « Tous les filtres ».

// La recherche du texte tapé ignore les accents : « reception » trouve « Réceptionniste ».
const withoutAccents = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "")

function toggled(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return [...groups]
}

// Option d'une liste à choix multiples : la coche suit la sélection, pas le focus clavier.
function CheckOption({
  value,
  keywords,
  checked,
  onToggle,
  children,
}: {
  value: string
  keywords: string[]
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <CommandItem
      value={value}
      keywords={[...keywords, ...keywords.map(withoutAccents)]}
      data-checked={checked}
      aria-checked={checked}
      onSelect={onToggle}
    >
      {children}
    </CommandItem>
  )
}

export function OccupationPicker({
  occupations,
}: {
  occupations: SearchReferentials["occupations"]
}) {
  const { values, update } = useSearch()
  const selected = values.occupations

  return (
    // `label` nomme le champ de recherche (cmdk le relie par aria-labelledby).
    <Command label="Rechercher un métier" className="rounded-lg border">
      <CommandInput placeholder="Rechercher un métier" />
      <CommandList label="Métiers">
        <CommandEmpty>Aucun métier ne correspond.</CommandEmpty>
        {groupBy(occupations, (o) => o.family).map(([family, items]) => (
          <CommandGroup key={family} heading={family}>
            {items.map((occupation) => (
              <CheckOption
                key={occupation.slug}
                value={occupation.slug}
                keywords={[occupation.label, family]}
                checked={selected.includes(occupation.slug)}
                onToggle={() =>
                  update({ occupations: toggled(selected, occupation.slug) })
                }
              >
                {occupation.label}
              </CheckOption>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

// Régions et départements, groupés par région : une offre est retenue si son département, ou sa
// région, est choisi.
export function LocationPicker({
  regions,
  departments,
}: Pick<SearchReferentials, "regions" | "departments">) {
  const { values, update } = useSearch()
  const byRegion = new Map(groupBy(departments, (d) => d.regionCode))

  return (
    <Command
      label="Rechercher une région ou un département"
      className="rounded-lg border"
    >
      <CommandInput placeholder="Région, département ou numéro" />
      <CommandList label="Lieux">
        <CommandEmpty>Aucun lieu ne correspond.</CommandEmpty>
        {regions.map((region) => (
          <CommandGroup key={region.code} heading={region.name}>
            <CheckOption
              value={`region-${region.code}`}
              keywords={[region.name, "région"]}
              checked={values.regions.includes(region.code)}
              onToggle={() =>
                update({ regions: toggled(values.regions, region.code) })
              }
            >
              {region.name} (toute la région)
            </CheckOption>
            {(byRegion.get(region.code) ?? []).map((department) => (
              <CheckOption
                key={department.code}
                value={`dept-${department.code}`}
                keywords={[department.name, department.code, region.name]}
                checked={values.departments.includes(department.code)}
                onToggle={() =>
                  update({
                    departments: toggled(values.departments, department.code),
                  })
                }
              >
                {department.name} ({department.code})
              </CheckOption>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

function availabilitySummary(from: string | null, to: string | null) {
  if (from && to) {
    return `Je suis disponible du ${formatIsoDate(from)} au ${formatIsoDate(to)}`
  }
  if (from) return `Je suis disponible à partir du ${formatIsoDate(from)}`
  if (to) return `Je suis disponible jusqu'au ${formatIsoDate(to)}`
  return "Je suis disponible du … au …"
}

// H4 : par défaut, le contrat doit tenir dans la disponibilité.
export function DatesFilter() {
  const { values, update } = useSearch()
  const id = useId()
  const { availableFrom: from, availableTo: to } = values
  const selected =
    from || to
      ? {
          from: from ? dateFromIso(from) : undefined,
          to: to ? dateFromIso(to) : undefined,
        }
      : undefined

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" aria-live="polite">
        {availabilitySummary(from, to)}
      </p>
      <Calendar
        mode="range"
        // Un premier clic fixe le début, le second la fin.
        min={1}
        locale={fr}
        selected={selected}
        defaultMonth={selected?.from ?? selected?.to}
        onSelect={(range) =>
          update({
            availableFrom: range?.from ? isoFromDate(range.from) : null,
            availableTo: range?.to ? isoFromDate(range.to) : null,
          })
        }
        className="mx-auto rounded-lg border [--cell-size:--spacing(9)]"
      />
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`${id}-flexible`}>Dates flexibles</Label>
        <Switch
          id={`${id}-flexible`}
          checked={values.flexibleDates}
          onCheckedChange={(checked) => update({ flexibleDates: checked })}
          aria-describedby={`${id}-flexible-help`}
        />
      </div>
      <p
        id={`${id}-flexible-help`}
        className="-mt-2 text-xs text-muted-foreground"
      >
        Inclut les contrats qui chevauchent vos dates.
      </p>
      {(from || to) && (
        <Button
          variant="outline"
          onClick={() => update({ availableFrom: null, availableTo: null })}
        >
          Effacer les dates
        </Button>
      )}
    </div>
  )
}

// H5 : une base (net ou brut), puis un minimum mensuel ; jamais de conversion entre les deux.
export function SalaryFilter() {
  const { values, update } = useSearch()
  const id = useId()
  const basis = values.salaryBasis

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        className="w-full"
        aria-label="Base du salaire"
        value={basis ?? ""}
        onValueChange={(value) =>
          update(
            value
              ? { salaryBasis: value as SalaryBasis }
              : { salaryBasis: null, salaryMinMonthly: null },
          )
        }
      >
        <ToggleGroupItem value="net" className="h-9 flex-1">
          Net
        </ToggleGroupItem>
        <ToggleGroupItem value="gross" className="h-9 flex-1">
          Brut
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-min`}>Salaire mensuel minimum (€)</Label>
        <Input
          id={`${id}-min`}
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="Par exemple 1800"
          disabled={!basis}
          value={values.salaryMinMonthly ?? ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "")
            // La saisie est temporisée : une seule recherche une fois le montant tapé.
            update(
              { salaryMinMonthly: digits ? Number(digits) : null },
              { limitUrlUpdates: debounce(400) },
            )
          }}
          aria-describedby={`${id}-min-help`}
        />
        <p id={`${id}-min-help`} className="text-xs text-muted-foreground">
          {basis
            ? `Seules les offres indiquant un salaire mensuel ${salaryBasisLabels[basis]} sont comparées.`
            : "Choisissez net ou brut pour indiquer un minimum."}
        </p>
      </div>
    </div>
  )
}

// Interrupteurs : un critère actif exige un « Oui » (ou un « Non » exigé) explicite de l'offre ;
// « Non précisé » n'y répond jamais.
export function SwitchesFilter({ fields }: { fields: SearchSwitch[] }) {
  const { values, update } = useSearch()
  const id = useId()

  return (
    <div className="flex flex-col gap-1">
      {fields.map((field) => (
        <div
          key={field}
          className="flex min-h-10 items-center justify-between gap-4"
        >
          <Label htmlFor={`${id}-${field}`} className="flex-1">
            {searchSwitchLabels[field]}
          </Label>
          <Switch
            id={`${id}-${field}`}
            checked={values[field]}
            onCheckedChange={(checked) => update({ [field]: checked })}
          />
        </div>
      ))}
    </div>
  )
}

// H6 : les offres sans langue exigée, ou dont toutes les langues exigées sont cochées.
export function LanguagesFilter() {
  const { values, update } = useSearch()
  const id = useId()
  const selected = values.spokenLanguages

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={`${id}-languages-help`}
    >
      <legend className="mb-1 text-sm font-medium">Langues que je parle</legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {languageCodes.map((code) => (
          <div key={code} className="flex min-h-9 items-center gap-2">
            <Checkbox
              id={`${id}-${code}`}
              checked={selected.includes(code)}
              onCheckedChange={() =>
                update({ spokenLanguages: toggled(selected, code) })
              }
            />
            <Label htmlFor={`${id}-${code}`}>{languageLabel(code)}</Label>
          </div>
        ))}
      </div>
      <p id={`${id}-languages-help`} className="text-xs text-muted-foreground">
        Les offres qui exigent une autre langue sont écartées ; celles qui
        n&rsquo;en exigent aucune restent affichées.
      </p>
    </fieldset>
  )
}

// H7 : temps plein ou partiel ; un second clic retire le critère.
export function WorkTimeFilter() {
  const { values, update } = useSearch()

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      className="w-full"
      aria-label="Temps de travail"
      value={values.workTime ?? ""}
      onValueChange={(value) =>
        update({ workTime: value ? (value as SearchWorkTime) : null })
      }
    >
      <ToggleGroupItem value="full_time" className="h-9 flex-1">
        Temps plein
      </ToggleGroupItem>
      <ToggleGroupItem value="part_time" className="h-9 flex-1">
        Temps partiel
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
