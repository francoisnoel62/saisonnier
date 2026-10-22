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
  CircleAlertIcon,
  PencilIcon,
} from "lucide-react"
import Link from "next/link"
import { startTransition, useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { Textarea } from "@/components/ui/textarea"
import type { ApplicationChannel } from "@/domain/offer"
import {
  involvesIntermediation,
  purchaseFormatLabels,
  SERVICE_NOTE_MAX_LENGTH,
  serviceKindDetails,
  serviceRequestStatusLabels,
  serviceRequestStatuses,
  serviceScopeLabels,
  type PurchaseFormat,
  type ServiceKind,
  type ServiceRequestStatus,
  type ServiceScope,
} from "@/domain/service-request"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDateTime } from "@/lib/format"
import { updateServiceRequestAction } from "@/server/services/actions"

// Demande de prestation telle que reçue du serveur : les dates voyagent en ISO.
export type ServiceRequestRow = {
  id: string
  createdAt: string
  status: ServiceRequestStatus
  companyName: string
  requesterName: string | null
  requesterEmail: string | null
  services: ServiceKind[]
  scope: ServiceScope
  scopeDetails: string | null
  purchaseFormat: PurchaseFormat
  message: string | null
  adminNote: string | null
  offerId: string | null
  offerTitle: string | null
  offerChannel: ApplicationChannel | null
  offerHidesCompany: boolean | null
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, ServiceRequestRow>()

const statusVariant: Record<
  ServiceRequestStatus,
  "default" | "secondary" | "outline"
> = {
  new: "default",
  in_progress: "secondary",
  done: "outline",
  cancelled: "outline",
}

const scopeOf = (row: ServiceRequestRow) =>
  row.scope === "offer" && row.offerTitle
    ? `${serviceScopeLabels.offer} : « ${row.offerTitle} »`
    : serviceScopeLabels[row.scope]

const columns = columnHelper.columns([
  columnHelper.accessor("createdAt", {
    header: "Date",
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  }),
  columnHelper.accessor("companyName", {
    header: "Entreprise",
    cell: ({ row }) => <RequestViewer row={row.original} />,
  }),
  columnHelper.accessor("services", {
    header: "Prestations",
    cell: ({ row }) => (
      <span className="block min-w-48 whitespace-normal">
        {row.original.services
          .map((service) => serviceKindDetails[service].label)
          .join(" · ")}
      </span>
    ),
  }),
  columnHelper.accessor("scope", {
    header: "Portée",
    cell: ({ row }) => (
      <span className="block min-w-40 whitespace-normal">
        {scopeOf(row.original)}
      </span>
    ),
  }),
  columnHelper.accessor("purchaseFormat", {
    header: "Formule",
    cell: ({ row }) => purchaseFormatLabels[row.original.purchaseFormat],
  }),
  columnHelper.accessor("status", {
    header: "Statut",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]}>
        {serviceRequestStatusLabels[row.original.status]}
      </Badge>
    ),
  }),
])

const ALL = "all"

export function ServiceRequestsTable({ rows }: { rows: ServiceRequestRow[] }) {
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
  const statusFilter = table.getColumn("status")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="service-status-filter">Statut</Label>
          <Select
            value={(statusFilter?.getFilterValue() as string) ?? ALL}
            onValueChange={(value) =>
              statusFilter?.setFilterValue(value === ALL ? undefined : value)
            }
          >
            <SelectTrigger
              id="service-status-filter"
              size="sm"
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {serviceRequestStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {serviceRequestStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {total} demande{total > 1 ? "s" : ""}
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
                  Aucune demande de prestation.
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

// Intermédiation (§7) : le service reçoit les candidatures, l'annonce passe sur le canal
// « chargé de recrutement » depuis le back-office (plan 15).
function IntermediationHint({ row }: { row: ServiceRequestRow }) {
  if (!involvesIntermediation(row.services)) return null
  const switched = row.offerChannel === "recruiter"
  return (
    <Alert>
      <CircleAlertIcon aria-hidden />
      <AlertTitle>Prestation avec intermédiation</AlertTitle>
      <AlertDescription>
        {row.offerId ? (
          <>
            <p>
              {switched
                ? `L'annonce est déjà confiée au chargé de recrutement${row.offerHidesCompany ? ", entreprise masquée" : ""}.`
                : "Basculez l'annonce sur le chargé de recrutement, et sur l'anonymat si l'employeur le souhaite."}
            </p>
            <Link
              href={`/admin/annonces/${row.offerId}/modifier`}
              className="inline-flex items-center gap-1 underline underline-offset-4"
            >
              <PencilIcon className="size-3" aria-hidden />
              Modifier l&rsquo;annonce
            </Link>
          </>
        ) : (
          <p>
            Les annonces concernées passent sur le chargé de recrutement depuis
            le back-office des annonces.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Détail d'une demande et son traitement manuel, dans un tiroir.
function RequestViewer({ row }: { row: ServiceRequestRow }) {
  const isMobile = useIsMobile()
  const [state, formAction, pending] = useActionState(
    updateServiceRequestAction,
    {},
  )

  useEffect(() => {
    if (state.done) toast.success("Demande mise à jour.")
  }, [state])

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button
          variant="link"
          className="h-auto w-fit px-0 text-left whitespace-normal text-foreground"
        >
          {row.companyName}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>Demande de {row.companyName}</DrawerTitle>
          <DrawerDescription>
            {formatDateTime(row.createdAt)} ·{" "}
            {serviceRequestStatusLabels[row.status]}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Demandeur</dt>
            <dd className="min-w-0 break-words">
              {row.requesterName ?? "Compte supprimé"}
              {row.requesterEmail && (
                <>
                  {" · "}
                  <a
                    href={`mailto:${row.requesterEmail}`}
                    className="underline underline-offset-4"
                  >
                    {row.requesterEmail}
                  </a>
                </>
              )}
            </dd>
            <dt className="text-muted-foreground">Prestations</dt>
            <dd>
              <ul className="list-disc pl-4">
                {row.services.map((service) => (
                  <li key={service}>{serviceKindDetails[service].label}</li>
                ))}
              </ul>
            </dd>
            <dt className="text-muted-foreground">Portée</dt>
            <dd className="min-w-0 break-words">
              {scopeOf(row)}
              {row.scopeDetails && (
                <span className="block text-muted-foreground">
                  {row.scopeDetails}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">Formule</dt>
            <dd>{purchaseFormatLabels[row.purchaseFormat]}</dd>
          </dl>
          {row.message && (
            <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">
              {row.message}
            </p>
          )}
          <IntermediationHint row={row} />

          {/* Envoi sans `action` : le formulaire garde le statut choisi et la note après l'envoi. */}
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              startTransition(() => formAction(formData))
            }}
          >
            {state.message && <FormAlert>{state.message}</FormAlert>}
            <input type="hidden" name="id" value={row.id} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`status-${row.id}`}>Statut</Label>
              <Select name="status" defaultValue={row.status}>
                <SelectTrigger id={`status-${row.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceRequestStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {serviceRequestStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`service-note-${row.id}`}>
                Note interne (facultatif)
              </Label>
              <Textarea
                id={`service-note-${row.id}`}
                name="adminNote"
                rows={3}
                maxLength={SERVICE_NOTE_MAX_LENGTH}
                defaultValue={row.adminNote ?? ""}
                aria-describedby={`service-note-hint-${row.id}`}
              />
              <p
                id={`service-note-hint-${row.id}`}
                className="text-muted-foreground"
              >
                Visible du seul service, jamais de l&rsquo;employeur.
              </p>
            </div>
            <SubmitButton pending={pending}>Enregistrer</SubmitButton>
          </form>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
