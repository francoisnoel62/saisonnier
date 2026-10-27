"use client"

import {
  columnVisibilityFeature,
  createColumnHelper,
  FlexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  Loader2Icon,
  MinusIcon,
} from "lucide-react"
import Link from "next/link"
import { unstable_rethrow, usePathname, useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  sourceListFilters,
  sourceListFilterLabels,
  type SourceListFilter,
} from "@/domain/scan/source-lifecycle"
import {
  scanAdapterLabels,
  scanSourceKindLabels,
  scanSourceStatusLabels,
  type ScanAdapterKind,
  type ScanSourceKind,
  type ScanSourceStatus,
} from "@/domain/scan/vocabulary"
import { formatDateTime } from "@/lib/format"
import { moveScanSourceAction } from "@/server/scan/sources/actions"
import type { ScanSourceListRow } from "@/server/scan/sources/registry"

import { useSourceLifecycle } from "./source-lifecycle"
import { useSourceTest } from "./source-test"

const features = tableFeatures({ columnVisibilityFeature })
const columnHelper = createColumnHelper<typeof features, ScanSourceListRow>()

export const statusVariant: Record<
  ScanSourceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ready: "default",
  draft: "secondary",
  rejected: "outline",
  archived: "outline",
}

export function StatusBadges({ row }: { row: ScanSourceListRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={statusVariant[row.status]}>
        {scanSourceStatusLabels[row.status]}
      </Badge>
      {row.enabled && <Badge variant="secondary">Activée</Badge>}
      {row.suspended && <Badge variant="destructive">Suspendue</Badge>}
    </div>
  )
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {on ? (
        <CheckIcon className="size-3.5" aria-hidden />
      ) : (
        <MinusIcon className="size-3.5 text-muted-foreground" aria-hidden />
      )}
      {label}
      <span className="sr-only">{on ? " : oui" : " : non"}</span>
    </span>
  )
}
// Ce qui est réellement lu : effet conjoint des interrupteurs (D11).
function Runs({ row }: { row: ScanSourceListRow }) {
  const enabled = row.status === "ready" && row.enabled && !row.suspended
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      <Flag on={enabled} label="Initial" />
      <Flag on={enabled && row.dailyEnabled} label="Quotidien" />
      <Flag on={enabled && row.dailyEnabled && row.autoPublish} label="Auto" />
    </div>
  )
}
function LastTest({ row }: { row: ScanSourceListRow }) {
  if (!row.lastTest)
    return <span className="text-muted-foreground">Jamais testée</span>
  return (
    <span>
      {formatDateTime(row.lastTest.at)} ·{" "}
      {row.lastTest.kind === "probe" ? "accès" : "échantillon"}{" "}
      {row.lastTest.ok === null
        ? "interrompu"
        : row.lastTest.ok
          ? "réussi"
          : "en échec"}
      {!row.lastTest.current && " (ancienne configuration)"}
    </span>
  )
}

const columns = columnHelper.columns([
  columnHelper.accessor("label", {
    header: "Source",
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col whitespace-normal">
        <Link
          className="font-medium underline-offset-4 hover:underline"
          href={`/admin/scan/sources/${row.original.key}`}
        >
          {row.original.label}
        </Link>
        <span className="text-muted-foreground">
          {scanSourceKindLabels[row.original.kind]}
        </span>
      </div>
    ),
  }),
  columnHelper.accessor("adapter", {
    header: "Connecteur",
    cell: ({ row }) => <Adapter row={row.original} />,
  }),
  columnHelper.accessor("status", {
    header: "Statut",
    cell: ({ row }) => (
      <div className="flex min-w-32 flex-col gap-1 whitespace-normal">
        <StatusBadges row={row.original} />
        {row.original.gap && (
          <span className="text-xs text-muted-foreground">
            {row.original.gap}
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.display({
    id: "runs",
    header: "Passages",
    cell: ({ row }) => <Runs row={row.original} />,
  }),
  columnHelper.display({
    id: "lastTest",
    header: "Dernier test",
    cell: ({ row }) => (
      <div className="min-w-40 whitespace-normal">
        <LastTest row={row.original} />
      </div>
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row.original} />,
  }),
])

function Adapter({ row }: { row: ScanSourceListRow }) {
  return row.adapter ? (
    <div className="flex flex-col whitespace-normal">
      <span>{scanAdapterLabels[row.adapter]}</span>
      {row.adapterVersion && (
        <span className="text-xs text-muted-foreground">
          {row.adapterVersion}
        </span>
      )}
    </div>
  ) : (
    <span className="text-muted-foreground">À déterminer</span>
  )
}

const ALL = "all"
export type SourceListQuery = {
  statut: SourceListFilter
  type?: ScanSourceKind
  connecteur?: ScanAdapterKind
  q?: string
}
export function filterSourceRows(
  rows: ScanSourceListRow[],
  query: SourceListQuery,
) {
  const search = query.q?.trim().toLocaleLowerCase("fr")
  return rows.filter(
    (row) =>
      (query.statut === "toutes"
        ? row.status !== "archived"
        : query.statut === "actives"
          ? row.status === "ready" && row.enabled
          : row.status ===
            {
              pretes: "ready",
              brouillons: "draft",
              ecartees: "rejected",
              archivees: "archived",
            }[query.statut]) &&
      (!query.type || row.kind === query.type) &&
      (!query.connecteur || row.adapter === query.connecteur) &&
      (!search ||
        `${row.label} ${row.key} ${row.officialHosts.join(" ")}`
          .toLocaleLowerCase("fr")
          .includes(search)),
  )
}

// Liste des sources (§11.2) : l'URL porte les filtres ; tableau à partir de md, cartes dessous.
export function SourcesTable({
  rows,
  query,
}: {
  rows: ScanSourceListRow[]
  query: SourceListQuery
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(query.q ?? "")
  const visible = useMemo(
    () => filterSourceRows(rows, { ...query, q: search }),
    [rows, query, search],
  )
  const table = useTable({
    features,
    data: visible,
    columns,
    getRowId: (row) => row.key,
  })
  function navigate(change: Partial<SourceListQuery>) {
    const next = { ...query, q: search, ...change }
    const params = new URLSearchParams()
    if (next.statut !== "toutes") params.set("statut", next.statut)
    if (next.type) params.set("type", next.type)
    if (next.connecteur) params.set("connecteur", next.connecteur)
    if (next.q) params.set("q", next.q)
    router.replace(params.size ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }
  const count = visible.length

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        value={query.statut}
        onValueChange={(value) =>
          navigate({ statut: value as SourceListFilter })
        }
        className="hidden sm:flex"
      >
        <TabsList>
          {sourceListFilters.map((filter) => (
            <TabsTrigger key={filter} value={filter}>
              {sourceListFilterLabels[filter]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:hidden">
          <Label htmlFor="source-status">Statut</Label>
          <Select
            value={query.statut}
            onValueChange={(value) =>
              navigate({ statut: value as SourceListFilter })
            }
          >
            <SelectTrigger id="source-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceListFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {sourceListFilterLabels[filter]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="source-search">Rechercher</Label>
          <Input
            id="source-search"
            type="search"
            placeholder="Libellé, clé ou hôte"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => navigate({ q: search || undefined })}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="source-kind">Type</Label>
          <Select
            value={query.type ?? ALL}
            onValueChange={(value) =>
              navigate({
                type: value === ALL ? undefined : (value as ScanSourceKind),
              })
            }
          >
            <SelectTrigger id="source-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {(["employer", "discovery"] as const).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {scanSourceKindLabels[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-56">
          <Label htmlFor="source-adapter">Connecteur</Label>
          <Select
            value={query.connecteur ?? ALL}
            onValueChange={(value) =>
              navigate({
                connecteur:
                  value === ALL ? undefined : (value as ScanAdapterKind),
              })
            }
          >
            <SelectTrigger id="source-adapter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {(Object.keys(scanAdapterLabels) as ScanAdapterKind[]).map(
                (kind) => (
                  <SelectItem key={kind} value={kind}>
                    {scanAdapterLabels[kind]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground sm:ml-auto"
        >
          {count} source{count > 1 ? "s" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">
          Aucune source. Ajoutez un portail employeur ou une recherche France
          Travail.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((row) => (
              <li
                key={row.key}
                className="flex min-w-0 flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      href={`/admin/scan/sources/${row.key}`}
                    >
                      {row.label}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {scanSourceKindLabels[row.kind]}
                      {row.adapter &&
                        ` · ${row.adapterVersion ?? scanAdapterLabels[row.adapter]}`}
                    </span>
                  </div>
                  <RowActions row={row} />
                </div>
                <StatusBadges row={row} />
                {row.gap && (
                  <p className="text-sm text-muted-foreground">{row.gap}</p>
                )}
                <Runs row={row} />
                <p className="text-sm">
                  Dernier test : <LastTest row={row} />
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
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
                      Aucune source ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

// Menu d'une source : ouvrir, modifier, tester, cycle de vie, ordre. Le serveur revérifie tout.
function RowActions({ row }: { row: ScanSourceListRow }) {
  const router = useRouter()
  const trigger = useRef<HTMLButtonElement>(null)
  const test = useSourceTest(row)
  const lifecycle = useSourceLifecycle(row)
  const [moving, startMove] = useTransition()
  function move(direction: "up" | "down") {
    startMove(async () => {
      try {
        const result = await moveScanSourceAction(row.key, direction)
        if (result.ok) router.refresh()
        else toast.error(result.message)
      } catch (error) {
        unstable_rethrow(error)
        toast.error("Le déplacement n’a pas abouti.")
      }
    })
  }
  const busy = test.pending || lifecycle.pending || moving
  return (
    <div className="flex justify-end">
      {/* Non modal : panneaux et dialogues s'ouvrent depuis le menu. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
            aria-busy={busy}
          >
            {busy ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <EllipsisVerticalIcon aria-hidden />
            )}
            <span className="sr-only">Actions pour « {row.label} »</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <DropdownMenuItem asChild>
            <Link href={`/admin/scan/sources/${row.key}`}>Ouvrir</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/scan/sources/${row.key}/modifier`}>
              Modifier
            </Link>
          </DropdownMenuItem>
          {row.testable && (
            <>
              <DropdownMenuItem
                onSelect={() => test.run("probe", trigger.current)}
              >
                Tester l’accès
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => test.run("sample", trigger.current)}
              >
                Extraire un échantillon
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {row.status === "ready" && (
            <DropdownMenuItem
              onSelect={() => lifecycle.request("back_to_draft")}
            >
              Repasser en brouillon
            </DropdownMenuItem>
          )}
          {(row.status === "draft" || row.status === "ready") && (
            <DropdownMenuItem onSelect={() => lifecycle.request("reject")}>
              Écarter
            </DropdownMenuItem>
          )}
          {row.status === "rejected" && (
            <DropdownMenuItem onSelect={() => lifecycle.request("reexamine")}>
              Réexaminer
            </DropdownMenuItem>
          )}
          {row.status === "archived" ? (
            <DropdownMenuItem onSelect={() => lifecycle.request("restore")}>
              Restaurer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => lifecycle.request("archive")}>
              Archiver
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => lifecycle.request("delete")}
          >
            Supprimer
          </DropdownMenuItem>
          {row.status !== "archived" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => move("up")}>
                <ArrowUpIcon aria-hidden /> Monter
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => move("down")}>
                <ArrowDownIcon aria-hidden /> Descendre
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {test.sheet}
      {lifecycle.dialogs}
    </div>
  )
}
