"use client"

import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { offerCountLabel } from "@/domain/offer-display"
import {
  activeCriteriaChips,
  type SearchReferentials,
  type SearchSwitch,
} from "@/domain/search-chips"
import type { SearchCriteria } from "@/domain/search-criteria"

import {
  DatesFilter,
  LanguagesFilter,
  LocationPicker,
  OccupationPicker,
  SalaryFilter,
  SwitchesFilter,
  WorkTimeFilter,
} from "./filter-controls"
import { useSearch } from "./search-provider"

type FilterGroup = {
  label: string
  // Critères actifs du groupe, pour le compteur de son bouton.
  count: (criteria: SearchCriteria) => number
  content: React.ReactNode
  popoverClassName?: string
}

const switchCount = (criteria: SearchCriteria, fields: SearchSwitch[]) =>
  fields.filter((field) => criteria[field]).length

const conditions: SearchSwitch[] = ["housing", "meals"]
const profile: SearchSwitch[] = ["beginnersWelcome", "noLicenseRequired"]
const practicalLife: SearchSwitch[] = ["couplesWelcome", "petsAllowed"]

// Les groupes de filtres, dans l'ordre de la fiche d'une offre.
function filterGroups(referentials: SearchReferentials): FilterGroup[] {
  return [
    {
      label: "Métier",
      count: (c) => c.occupations?.length ?? 0,
      content: <OccupationPicker occupations={referentials.occupations} />,
      popoverClassName: "w-80 p-0",
    },
    {
      label: "Lieu",
      count: (c) => (c.regions?.length ?? 0) + (c.departments?.length ?? 0),
      content: (
        <LocationPicker
          regions={referentials.regions}
          departments={referentials.departments}
        />
      ),
      popoverClassName: "w-80 p-0",
    },
    {
      label: "Dates",
      count: (c) => (c.availableFrom || c.availableTo ? 1 : 0),
      content: <DatesFilter />,
      popoverClassName: "w-auto p-3",
    },
    {
      label: "Rémunération",
      count: (c) => (c.salaryMinMonthly !== undefined ? 1 : 0),
      content: <SalaryFilter />,
    },
    {
      label: "Conditions",
      count: (c) => switchCount(c, conditions),
      content: <SwitchesFilter fields={conditions} />,
    },
    {
      label: "Profil",
      count: (c) =>
        switchCount(c, profile) + (c.spokenLanguages?.length ? 1 : 0),
      content: (
        <div className="flex flex-col gap-4">
          <SwitchesFilter fields={profile} />
          <LanguagesFilter />
        </div>
      ),
    },
    {
      label: "Temps de travail",
      count: (c) => (c.workTime ? 1 : 0),
      content: <WorkTimeFilter />,
    },
    {
      label: "Vie pratique",
      count: (c) => switchCount(c, practicalLife),
      content: <SwitchesFilter fields={practicalLife} />,
    },
  ]
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Badge className="rounded-full tabular-nums">
      {count}
      <span className="sr-only"> actif{count > 1 ? "s" : ""}</span>
    </Badge>
  )
}

// Barre de filtres (un popover par groupe) sur ordinateur, panneau plein écran sur mobile. Les
// deux écrivent la même URL : aucun bouton « valider ».
export function SearchFilters({
  referentials,
  total,
}: {
  referentials: SearchReferentials
  total: number
}) {
  const { criteria, replace, isPending } = useSearch()
  const [open, setOpen] = useState(false)
  const groups = filterGroups(referentials)
  const activeCount = activeCriteriaChips(criteria, referentials).length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-2">
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="md:hidden">
            <SlidersHorizontalIcon data-icon="inline-start" />
            Filtres
            <CountBadge count={activeCount} />
          </Button>
        </SheetTrigger>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {groups.map((group) => {
            const count = group.count(criteria)
            return (
              <Popover key={group.label}>
                <PopoverTrigger asChild>
                  <Button
                    variant={count > 0 ? "secondary" : "outline"}
                    size="lg"
                  >
                    {group.label}
                    <CountBadge count={count} />
                    <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className={group.popoverClassName ?? "w-80 p-3"}
                >
                  {group.content}
                </PopoverContent>
              </Popover>
            )
          })}
          <SheetTrigger asChild>
            <Button variant="ghost" size="lg">
              <SlidersHorizontalIcon data-icon="inline-start" />
              Tous les filtres
            </Button>
          </SheetTrigger>
        </div>
      </div>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center justify-between border-b">
          <SheetTitle>Filtres</SheetTitle>
          <SheetDescription className="sr-only">
            Chaque changement met à jour la liste des offres.
          </SheetDescription>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-lg" aria-label="Fermer">
              <XIcon />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-3">
              <h2 className="font-medium">{group.label}</h2>
              {group.content}
            </section>
          ))}
        </div>

        <SheetFooter className="flex-row border-t">
          <Button
            variant="outline"
            size="lg"
            disabled={activeCount === 0}
            onClick={() => replace({})}
          >
            Tout effacer
          </Button>
          <SheetClose asChild>
            <Button size="lg" className="flex-1" aria-live="polite">
              {isPending
                ? "Mise à jour…"
                : total === 0
                  ? "Aucune offre"
                  : `Voir ${offerCountLabel(total)}`}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
