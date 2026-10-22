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
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "lucide-react"
import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"

import { SubmitButton } from "@/components/auth/submit-button"
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
import { FormAlert } from "@/components/auth/form-alert"
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
import {
  ADMIN_NOTE_MAX_LENGTH,
  contactStatusLabels,
  contactTopicLabels,
  type ContactStatus,
  type ContactTopic,
} from "@/domain/contact"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDateTime } from "@/lib/format"
import { markContactHandled } from "@/server/contact/actions"

// Message tel que reçu du serveur : les dates voyagent en ISO.
export type ContactMessageRow = {
  id: string
  topic: ContactTopic
  offerId: string | null
  name: string
  email: string
  companyName: string | null
  phone: string | null
  message: string
  status: ContactStatus
  adminNote: string | null
  createdAt: string
  handledAt: string | null
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, ContactMessageRow>()

const columns = columnHelper.columns([
  columnHelper.accessor("createdAt", {
    header: "Date",
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  }),
  columnHelper.accessor("topic", {
    header: "Sujet",
    cell: ({ row }) => contactTopicLabels[row.original.topic],
  }),
  columnHelper.accessor("name", {
    header: "Nom",
    cell: ({ row }) => <MessageViewer message={row.original} />,
  }),
  columnHelper.accessor("email", { header: "Email" }),
  columnHelper.accessor("offerId", {
    header: "Annonce liée",
    cell: ({ row }) =>
      row.original.offerId ? (
        <Link
          href={`/admin/annonces/${row.original.offerId}/modifier`}
          className="font-mono text-xs underline underline-offset-4"
        >
          {row.original.offerId.slice(0, 8)}
          <span className="sr-only"> : modifier l&rsquo;annonce</span>
        </Link>
      ) : (
        "—"
      ),
  }),
  columnHelper.accessor("status", {
    header: "Statut",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "new" ? "default" : "outline"}>
        {contactStatusLabels[row.original.status]}
      </Badge>
    ),
  }),
])

const ALL = "all"

export function ContactMessagesTable({
  messages,
}: {
  messages: ContactMessageRow[]
}) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const table = useTable({
    features,
    data: messages,
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
          <Label htmlFor="status-filter">Statut</Label>
          <Select
            value={(statusFilter?.getFilterValue() as string) ?? ALL}
            onValueChange={(value) =>
              statusFilter?.setFilterValue(value === ALL ? undefined : value)
            }
          >
            <SelectTrigger id="status-filter" size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              <SelectItem value="new">{contactStatusLabels.new}</SelectItem>
              <SelectItem value="handled">
                {contactStatusLabels.handled}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {total} message{total > 1 ? "s" : ""}
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
                    <TableCell key={cell.id}>
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
                  Aucun message.
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

// Détail d'un message dans un tiroir, comme dans le tableau du tableau de bord.
function MessageViewer({ message }: { message: ContactMessageRow }) {
  const isMobile = useIsMobile()
  const [state, formAction, pending] = useActionState(markContactHandled, {})

  useEffect(() => {
    if (state.done) {
      toast.success("Message marqué comme traité.")
    }
  }, [state])

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {message.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{message.name}</DrawerTitle>
          <DrawerDescription>
            {contactTopicLabels[message.topic]} ·{" "}
            {formatDateTime(message.createdAt)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Email</dt>
            <dd>
              <a
                href={`mailto:${message.email}`}
                className="underline underline-offset-4"
              >
                {message.email}
              </a>
            </dd>
            {message.phone && (
              <>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>{message.phone}</dd>
              </>
            )}
            {message.companyName && (
              <>
                <dt className="text-muted-foreground">Entreprise</dt>
                <dd>{message.companyName}</dd>
              </>
            )}
            {message.offerId && (
              <>
                <dt className="text-muted-foreground">Annonce liée</dt>
                <dd className="font-mono text-xs">{message.offerId}</dd>
              </>
            )}
          </dl>
          {/* Demande d'un employeur sur son annonce : la correction se fait dans le back-office. */}
          {message.offerId && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/admin/annonces/${message.offerId}/modifier`}>
                  <PencilIcon data-icon="inline-start" aria-hidden />
                  Modifier l&rsquo;annonce
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/offres/${message.offerId}`}>Voir la fiche</Link>
              </Button>
            </div>
          )}
          <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">
            {message.message}
          </p>

          {message.status === "handled" ? (
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                Traité le{" "}
                {message.handledAt ? formatDateTime(message.handledAt) : "—"}
              </p>
              {message.adminNote && (
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {message.adminNote}
                </p>
              )}
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              {state.message && <FormAlert>{state.message}</FormAlert>}
              <input type="hidden" name="id" value={message.id} />
              <Label htmlFor={`note-${message.id}`}>Note (facultatif)</Label>
              <Textarea
                id={`note-${message.id}`}
                name="adminNote"
                rows={3}
                maxLength={ADMIN_NOTE_MAX_LENGTH}
              />
              <SubmitButton pending={pending}>
                Marquer comme traité
              </SubmitButton>
            </form>
          )}
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
