"use client"

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  FlexRender,
  filterFn_equalsString,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { useRef, useState, useTransition } from "react"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { formatDate } from "@/lib/format"
import {
  republishOffer,
  unpublishOffer,
  type OfferStatusResult,
} from "@/server/offers/employer-actions"

// Annonce de l'espace employeur telle que reçue du serveur : libellés et droits déjà calculés.
export type EmployerOfferRow = {
  id: string
  title: string
  state: EmployerOfferState
  // Précision sous le statut : échéance passée, vérification en attente…
  note: string | null
  location: string
  season: string
  period: string
  validityConfirmedAt: string | null
  canEdit: boolean
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

const columnHelper = createColumnHelper<typeof features, EmployerOfferRow>()

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

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Intitulé",
    cell: ({ row }) => (
      <span className="block min-w-40 font-medium whitespace-normal">
        {row.original.title}
      </span>
    ),
  }),
  columnHelper.accessor("state", {
    header: "Statut",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <div className="flex min-w-36 flex-col items-start gap-1 whitespace-normal">
        <Badge variant={stateVariant[row.original.state]}>
          {employerOfferStateLabels[row.original.state]}
        </Badge>
        {row.original.note && (
          <span className="text-xs text-muted-foreground">
            {row.original.note}
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("location", { header: "Lieu" }),
  columnHelper.accessor("period", {
    header: "Saison et dates",
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col whitespace-normal">
        <span>{row.original.season}</span>
        <span className="text-muted-foreground">{row.original.period}</span>
      </div>
    ),
  }),
  columnHelper.accessor("validityConfirmedAt", {
    header: "Validité confirmée le",
    cell: ({ row }) =>
      row.original.validityConfirmedAt
        ? formatDate(row.original.validityConfirmedAt)
        : "—",
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  }),
])

const ALL = "all"

export function EmployerOffersTable({ rows }: { rows: EmployerOfferRow[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const table = useTable({
    features,
    data: rows,
    columns,
    state: { columnFilters, pagination },
    getRowId: (row) => row.id,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
  })

  const total = table.getFilteredRowModel().rows.length
  const stateFilter = table.getColumn("state")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="state-filter">Statut</Label>
          <Select
            value={(stateFilter?.getFilterValue() as string) ?? ALL}
            onValueChange={(value) =>
              stateFilter?.setFilterValue(value === ALL ? undefined : value)
            }
          >
            <SelectTrigger id="state-filter" size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {employerOfferStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {employerOfferStateLabels[state]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
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
                  Aucune annonce dans cet état.
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

// Aperçu, modification, mise hors ligne ou remise en ligne d'une annonce. Le serveur revérifie
// chaque droit ; un refus (échéance dépassée, par exemple) s'affiche tel qu'il le formule.
function RowActions({ row }: { row: EmployerOfferRow }) {
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
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
            <EyeIcon aria-hidden />
            Aperçu
          </DropdownMenuItem>
          {row.canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/employeur/annonces/${row.id}/modifier`}>
                <PencilIcon aria-hidden />
                Modifier
              </Link>
            </DropdownMenuItem>
          )}
          {row.canUnpublish && (
            <DropdownMenuItem
              onSelect={() =>
                change(
                  unpublishOffer,
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
                  republishOffer,
                  `« ${row.title} » est de nouveau en ligne.`,
                )
              }
            >
              <RotateCcwIcon aria-hidden />
              Remettre en ligne
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
