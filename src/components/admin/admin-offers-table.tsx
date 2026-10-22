"use client"

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  FlexRender,
  filterFn_equalsString,
  filterFn_includesString,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import {
  BadgeCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  OfferPreview,
  OfferPreviewSheet,
  type OfferPreviewData,
} from "@/components/offers/offer-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  employerOfferStateLabels,
  employerOfferStates,
  type EmployerOfferState,
} from "@/domain/employer-offer"
import { offerOrigins, type OfferOrigin } from "@/domain/offer"
import { originLabels } from "@/domain/offer-display"
import { site } from "@/config/site"
import { formatDate } from "@/lib/format"
import {
  adminRepublishOffer,
  adminUnpublishOffer,
  confirmSourceChecked,
} from "@/server/offers/admin-actions"
import type { OfferStatusResult } from "@/server/offers/employer-actions"

// Annonce du back-office telle que reçue du serveur : libellés et droits déjà calculés.
export type AdminOfferRow = {
  id: string
  title: string
  origin: OfferOrigin
  state: EmployerOfferState
  // Raison sociale ou enseigne : l'admin connaît toujours l'entreprise (§7).
  companyName: string
  anonymous: boolean
  recruiterName: string | null
  location: string
  period: string
  // Annonce collectée : sa source et la date de sa dernière vérification.
  sourceUrl: string | null
  sourceName: string | null
  sourceCheckedAt: string | null
  validityConfirmedAt: string | null
  // Destinations ou source vers un domaine exclu : à corriger (§2, §9).
  blocked: string[]
  canUnpublish: boolean
  canRepublish: boolean
  preview: OfferPreviewData
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, AdminOfferRow>()

const stateVariant: Record<
  EmployerOfferState,
  "default" | "secondary" | "outline" | "destructive"
> = {
  online: "default",
  pending_review: "secondary",
  offline: "outline",
  expired: "outline",
  rejected: "destructive",
}

// Dans le tableau, l'origine tient en un mot ; le filtre la nomme en entier.
const originShortLabels: Record<OfferOrigin, string> = {
  deposited: "Déposée",
  collected: "Collectée",
}

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Intitulé",
    filterFn: filterFn_includesString,
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col items-start gap-1 whitespace-normal">
        <span className="font-medium">{row.original.title}</span>
        {row.original.blocked.length > 0 && (
          <>
            <Badge variant="destructive">
              <CircleAlertIcon aria-hidden />
              Domaine exclu
            </Badge>
            {row.original.blocked.map((message) => (
              <span key={message} className="text-xs text-destructive">
                {message}
              </span>
            ))}
          </>
        )}
        {row.original.recruiterName && (
          <span className="text-xs text-muted-foreground">
            Chargé de recrutement : {row.original.recruiterName}
            {row.original.anonymous && " · entreprise masquée"}
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("origin", {
    header: "Origine",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <Badge variant="outline" title={originLabels[row.original.origin]}>
        {originShortLabels[row.original.origin]}
      </Badge>
    ),
  }),
  columnHelper.accessor("companyName", {
    header: "Entreprise",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <span className="block min-w-32 whitespace-normal">
        {row.original.companyName}
      </span>
    ),
  }),
  columnHelper.accessor("state", {
    header: "Statut",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <Badge variant={stateVariant[row.original.state]}>
        {employerOfferStateLabels[row.original.state]}
      </Badge>
    ),
  }),
  columnHelper.accessor("location", {
    header: "Lieu et période",
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col whitespace-normal">
        <span>{row.original.location}</span>
        <span className="text-muted-foreground">{row.original.period}</span>
      </div>
    ),
  }),
  columnHelper.accessor("sourceCheckedAt", {
    header: "Suivi",
    cell: ({ row }) => <Follow row={row.original} />,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  }),
])

// Collectée : sa source et sa dernière vérification ; déposée : sa dernière confirmation.
function Follow({ row }: { row: AdminOfferRow }) {
  if (row.origin === "collected") {
    return (
      <div className="flex min-w-40 flex-col whitespace-normal">
        {row.sourceUrl && (
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-4"
          >
            {row.sourceName ?? "Source"}
            <ExternalLinkIcon className="size-3" aria-hidden />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        )}
        <span className="text-muted-foreground">
          {row.sourceCheckedAt
            ? `Vérifiée le ${formatDate(row.sourceCheckedAt)}`
            : "Jamais vérifiée"}
        </span>
      </div>
    )
  }
  return (
    <span className="text-muted-foreground">
      {row.validityConfirmedAt
        ? `Validité confirmée le ${formatDate(row.validityConfirmedAt)}`
        : "—"}
    </span>
  )
}

const ALL = "all"

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : next)}
      >
        <SelectTrigger id={id} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Toutes</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function AdminOffersTable({ rows }: { rows: AdminOfferRow[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  const table = useTable({
    features,
    data: rows,
    columns,
    state: { columnFilters, pagination },
    getRowId: (row) => row.id,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
  })

  const companyNames = useMemo(
    () =>
      [...new Set(rows.map((row) => row.companyName))].sort((a, b) =>
        a.localeCompare(b, site.locale),
      ),
    [rows],
  )
  const total = table.getFilteredRowModel().rows.length
  const column = (id: "title" | "origin" | "companyName" | "state") =>
    table.getColumn(id)
  const filterOf = (id: "title" | "origin" | "companyName" | "state") =>
    column(id)?.getFilterValue() as string | undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="title-filter">Intitulé</Label>
          <Input
            id="title-filter"
            type="search"
            placeholder="Rechercher dans les intitulés"
            value={filterOf("title") ?? ""}
            onChange={(event) =>
              column("title")?.setFilterValue(event.target.value || undefined)
            }
          />
        </div>
        <FilterSelect
          id="origin-filter"
          label="Origine"
          value={filterOf("origin")}
          onChange={(value) => column("origin")?.setFilterValue(value)}
          options={offerOrigins.map((origin) => ({
            value: origin,
            label: originLabels[origin],
          }))}
          className="w-64"
        />
        <FilterSelect
          id="state-filter"
          label="Statut"
          value={filterOf("state")}
          onChange={(value) => column("state")?.setFilterValue(value)}
          options={employerOfferStates.map((state) => ({
            value: state,
            label: employerOfferStateLabels[state],
          }))}
          className="w-56"
        />
        <FilterSelect
          id="company-filter"
          label="Entreprise"
          value={filterOf("companyName")}
          onChange={(value) => column("companyName")?.setFilterValue(value)}
          options={companyNames.map((name) => ({ value: name, label: name }))}
          className="w-56"
        />
        <p aria-live="polite" className="ml-auto text-sm text-muted-foreground">
          {total} annonce{total > 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top">
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aucune annonce ne correspond à ces filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <span>
            Page {table.state.pagination.pageIndex + 1} sur{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Page précédente</span>
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Page suivante</span>
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}

// Aperçu, fiche, modification, statut et vérification de la source d'une annonce. Le serveur
// revérifie chaque action ; un refus s'affiche tel qu'il le formule.
function RowActions({ row }: { row: AdminOfferRow }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)

  function change(
    action: (offerId: string) => Promise<OfferStatusResult>,
    success: string,
  ) {
    // Une action à la fois. Le bouton du menu reste actif : désactivé, il perdrait le focus
    // clavier pendant l'action.
    if (pending) return
    startTransition(async () => {
      try {
        const result = await action(row.id)
        if (result.ok) toast.success(success)
        else toast.error(result.message)
      } catch (error) {
        unstable_rethrow(error)
        toast.error(
          "L'action n'a pas abouti. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <div className="flex justify-end">
      {/* Non modal : le panneau d'aperçu s'ouvre depuis le menu. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
            aria-busy={pending}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <EllipsisVerticalIcon aria-hidden />
            )}
            <span className="sr-only">Actions pour « {row.title} »</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
            <EyeIcon aria-hidden />
            Aperçu
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/offres/${row.id}`}>
              <ExternalLinkIcon aria-hidden />
              Voir la fiche
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/annonces/${row.id}/modifier`}>
              <PencilIcon aria-hidden />
              Modifier
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {row.canUnpublish && (
            <DropdownMenuItem
              onSelect={() =>
                change(
                  adminUnpublishOffer,
                  `« ${row.title} » est hors ligne : les candidats ne la voient plus.`,
                )
              }
            >
              <EyeOffIcon aria-hidden />
              Mettre hors ligne
            </DropdownMenuItem>
          )}
          {row.canRepublish && (
            <DropdownMenuItem
              onSelect={() =>
                change(
                  adminRepublishOffer,
                  `« ${row.title} » est de nouveau en ligne.`,
                )
              }
            >
              <RotateCcwIcon aria-hidden />
              Remettre en ligne
            </DropdownMenuItem>
          )}
          {row.origin === "collected" && (
            <DropdownMenuItem
              onSelect={() =>
                change(
                  confirmSourceChecked,
                  `Source de « ${row.title} » vérifiée aujourd'hui.`,
                )
              }
            >
              <BadgeCheckIcon aria-hidden />
              Source vérifiée aujourd&rsquo;hui
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <OfferPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onCloseAutoFocus={(event) => {
          // Le menu qui l'a ouvert n'est plus là : le focus revient à son bouton.
          event.preventDefault()
          triggerRef.current?.focus()
        }}
      >
        <OfferPreview preview={row.preview} />
      </OfferPreviewSheet>
    </div>
  )
}
