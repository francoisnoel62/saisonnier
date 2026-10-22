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
  CircleCheckIcon,
  CircleHelpIcon,
  CircleMinusIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { useActionState, useState } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
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
import {
  membershipStatusLabels,
  membershipStatuses,
  REVIEW_NOTE_MAX_LENGTH,
  type MembershipStatus,
} from "@/domain/membership"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDateTime } from "@/lib/format"
import { reviewMembership, type ReviewState } from "@/server/companies/actions"

// Demande de rattachement telle que reçue du serveur : dates en ISO, indicateurs calculés.
export type VerificationRow = {
  userId: string
  name: string
  email: string
  phone: string | null
  jobTitle: string
  relationship: string
  status: MembershipStatus
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  companyName: string
  displayName: string | null
  siren: string | null
  siret: string | null
  annuaireUrl: string | null
  nafCode: string | null
  nafLabel: string | null
  // Activité du tourisme ou des loisirs (§2) : une aide, pas une décision.
  tourism: boolean
  communeName: string | null
  website: string | null
  // Domaine de l'email = domaine du site ; null sans site. Une aide, pas une décision.
  emailMatchesSite: boolean | null
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, VerificationRow>()

const statusVariant: Record<
  MembershipStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline underline-offset-4"
    >
      {children}
      <ExternalLinkIcon className="size-3" aria-hidden />
      <span className="sr-only">(nouvel onglet)</span>
    </a>
  )
}

function EmailMatch({ match }: { match: boolean | null }) {
  if (match === null) {
    return (
      <Badge variant="outline">
        <CircleMinusIcon aria-hidden />
        Pas de site
      </Badge>
    )
  }
  return match ? (
    <Badge variant="secondary">
      <CircleCheckIcon aria-hidden />
      Domaine du site
    </Badge>
  ) : (
    <Badge variant="outline">
      <CircleHelpIcon aria-hidden />
      Autre domaine
    </Badge>
  )
}

function Activity({ row }: { row: VerificationRow }) {
  if (!row.nafCode) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex min-w-48 flex-col gap-1 whitespace-normal">
      <span>
        <span className="font-mono text-xs">{row.nafCode}</span>
        {row.nafLabel && ` ${row.nafLabel}`}
      </span>
      {row.tourism ? (
        <Badge variant="secondary">Tourisme / loisirs</Badge>
      ) : (
        <Badge variant="outline">Secteur à vérifier</Badge>
      )}
    </div>
  )
}

const columns = columnHelper.columns([
  columnHelper.accessor("createdAt", {
    header: "Date",
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  }),
  columnHelper.accessor("name", {
    header: "Déposant",
    cell: ({ row }) => <VerificationReview row={row.original} />,
  }),
  columnHelper.accessor("email", {
    header: "Email",
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <span>{row.original.email}</span>
        <EmailMatch match={row.original.emailMatchesSite} />
      </div>
    ),
  }),
  columnHelper.accessor("jobTitle", { header: "Fonction" }),
  columnHelper.accessor("relationship", { header: "Lien" }),
  columnHelper.accessor("companyName", {
    header: "Entreprise",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.companyName}</span>
        {row.original.displayName && (
          <span className="text-muted-foreground">
            {row.original.displayName}
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("siren", {
    header: "SIREN",
    cell: ({ row }) =>
      row.original.siren && row.original.annuaireUrl ? (
        <ExternalLink href={row.original.annuaireUrl}>
          {row.original.siren}
        </ExternalLink>
      ) : (
        "—"
      ),
  }),
  columnHelper.accessor("nafCode", {
    header: "Activité (NAF)",
    cell: ({ row }) => <Activity row={row.original} />,
  }),
  columnHelper.accessor("website", {
    header: "Site",
    cell: ({ row }) =>
      row.original.website ? (
        <ExternalLink href={row.original.website}>
          {new URL(row.original.website).hostname}
        </ExternalLink>
      ) : (
        "—"
      ),
  }),
  columnHelper.accessor("status", {
    header: "Statut",
    filterFn: filterFn_equalsString,
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]}>
        {membershipStatusLabels[row.original.status]}
      </Badge>
    ),
  }),
])

const ALL = "all"

export function VerificationsTable({ rows }: { rows: VerificationRow[] }) {
  // Les demandes à traiter d'abord.
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "status", value: "pending" },
  ])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const table = useTable({
    features,
    data: rows,
    columns,
    state: { columnFilters, pagination },
    getRowId: (row) => row.userId,
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
            <SelectTrigger id="status-filter" size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {membershipStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {membershipStatusLabels[status]}
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
                  Aucune demande.
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

// Détail d'une demande et décision, dans un tiroir.
function VerificationReview({ row }: { row: VerificationRow }) {
  const isMobile = useIsMobile()
  // Le toast part de l'action : une fois décidée, la demande quitte le filtre « En vérification »
  // et ce composant disparaît avec sa ligne.
  const decide =
    (done: string) => async (state: ReviewState, formData: FormData) => {
      const result = await reviewMembership(state, formData)
      if (result.done) toast.success(done)
      return result
    }
  const [verifyState, verifyAction, verifying] = useActionState(
    decide(`Rattachement de ${row.name} validé.`),
    {},
  )
  const [rejectState, rejectAction, rejecting] = useActionState(
    decide(`Rattachement de ${row.name} refusé.`),
    {},
  )
  const pending = verifying || rejecting

  const details: [string, React.ReactNode][] = [
    [
      "Email",
      <a
        key="email"
        href={`mailto:${row.email}`}
        className="underline underline-offset-4"
      >
        {row.email}
      </a>,
    ],
    ["Téléphone", row.phone ?? "—"],
    ["Fonction", row.jobTitle],
    ["Lien", row.relationship],
    [
      "Entreprise",
      row.displayName
        ? `${row.companyName} (${row.displayName})`
        : row.companyName,
    ],
    [
      "SIREN",
      row.siren && row.annuaireUrl ? (
        <ExternalLink key="siren" href={row.annuaireUrl}>
          {row.siren} sur l&rsquo;Annuaire des entreprises
        </ExternalLink>
      ) : (
        "—"
      ),
    ],
    ["SIRET", row.siret ?? "—"],
    ["Commune", row.communeName ?? "—"],
    ["Activité", <Activity key="naf" row={row} />],
    [
      "Site",
      row.website ? (
        <ExternalLink key="site" href={row.website}>
          {row.website}
        </ExternalLink>
      ) : (
        "—"
      ),
    ],
    ["Email et site", <EmailMatch key="match" match={row.emailMatchesSite} />],
  ]

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {row.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{row.name}</DrawerTitle>
          <DrawerDescription>
            Demande du {formatDateTime(row.createdAt)} ·{" "}
            {membershipStatusLabels[row.status]}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground">
            Les indicateurs aident à décider ; ils ne prouvent rien. En cas de
            doute, appelez le déposant ou consultez l&rsquo;annuaire.
          </p>

          {row.status === "pending" ? (
            <div className="flex flex-col gap-4">
              <form action={verifyAction}>
                {verifyState.message && (
                  <FormAlert>{verifyState.message}</FormAlert>
                )}
                <input type="hidden" name="userId" value={row.userId} />
                <input type="hidden" name="decision" value="verify" />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending}
                  aria-busy={verifying}
                >
                  Valider le rattachement
                </Button>
              </form>
              <form action={rejectAction} className="flex flex-col gap-2">
                {rejectState.message && (
                  <FormAlert>{rejectState.message}</FormAlert>
                )}
                <input type="hidden" name="userId" value={row.userId} />
                <input type="hidden" name="decision" value="reject" />
                <Label htmlFor={`note-${row.userId}`}>Motif du refus</Label>
                <Textarea
                  id={`note-${row.userId}`}
                  name="reviewNote"
                  rows={3}
                  required
                  maxLength={REVIEW_NOTE_MAX_LENGTH}
                  aria-describedby={`note-hint-${row.userId}`}
                />
                <p
                  id={`note-hint-${row.userId}`}
                  className="text-muted-foreground"
                >
                  Envoyé à l&rsquo;employeur avec la décision.
                </p>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={pending}
                  aria-busy={rejecting}
                >
                  Refuser le rattachement
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {membershipStatusLabels[row.status]} le{" "}
                {row.reviewedAt ? formatDateTime(row.reviewedAt) : "—"}
              </p>
              {row.reviewNote && (
                <p className="whitespace-pre-wrap text-muted-foreground">
                  Motif : {row.reviewNote}
                </p>
              )}
            </div>
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
