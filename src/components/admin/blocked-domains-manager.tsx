"use client"

import {
  columnVisibilityFeature,
  createColumnHelper,
  FlexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { CircleAlertIcon, PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BLOCKED_DOMAIN_REASON_MAX_LENGTH } from "@/domain/blocked-domains"
import { formatDate } from "@/lib/format"
import { allowDomain, excludeDomain } from "@/server/referentials/actions"
import type { AffectedOffer } from "@/server/referentials/admin"

// Job-boards et agrégateurs exclus (§2, H9) : aucune annonce n'y mène, ni par sa candidature, ni
// par sa source.

export type BlockedDomainRow = {
  domain: string
  reason: string | null
  createdAt: string
}

const features = tableFeatures({ columnVisibilityFeature })

const columnHelper = createColumnHelper<typeof features, BlockedDomainRow>()

const offerCount = (count: number) =>
  `${count} annonce${count > 1 ? "s" : ""} publiée${count > 1 ? "s" : ""}`

// Annonces publiées qui mènent à un domaine exclu : la fiche masque déjà ces liens, mais l'admin
// les remplace par un contact direct.
function AffectedOffers({ offers }: { offers: AffectedOffer[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {offers.map((offer) => (
        <li
          key={offer.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <span>
            <span className="font-medium">{offer.title}</span>
            {offer.companyName && ` · ${offer.companyName}`}
          </span>
          <Link
            href={`/admin/annonces/${offer.id}/modifier`}
            className="inline-flex items-center gap-1 underline underline-offset-4"
          >
            <PencilIcon className="size-3" aria-hidden />
            Modifier<span className="sr-only"> « {offer.title} »</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AddDomainForm({
  onAdded,
}: {
  onAdded: (domain: string, affected: AffectedOffer[]) => void
}) {
  const empty = { domain: "", reason: "" }
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState<
    Partial<Record<"domain" | "reason", string[]>>
  >({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await excludeDomain(values)
        if (!result.ok) {
          setErrors(result.fieldErrors)
          return
        }
        toast.success(
          result.created
            ? `${result.domain} est exclu.`
            : `${result.domain} était déjà exclu.`,
        )
        onAdded(result.domain, result.affected)
        setValues(empty)
        setErrors({})
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "Le domaine n'a pas été ajouté. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  const fields = [
    {
      name: "domain",
      label: "Domaine à exclure",
      hint: "Un domaine, ou l'adresse d'une de ses pages : ses sous-domaines sont exclus aussi.",
      maxLength: 500,
    },
    {
      name: "reason",
      label: "Motif",
      hint: "Par exemple : job-board, agrégateur.",
      maxLength: BLOCKED_DOMAIN_REASON_MAX_LENGTH,
    },
  ] as const

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h3 className="font-medium">Exclure un domaine</h3>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ name, label, hint, maxLength }) => {
          const id = `domaine-${name}`
          const error = errors[name]?.[0]
          return (
            <Field key={name} data-invalid={!!error}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <Input
                id={id}
                value={values[name]}
                maxLength={maxLength}
                autoComplete="off"
                onChange={(event) =>
                  setValues({ ...values, [name]: event.target.value })
                }
                aria-invalid={!!error}
                aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              />
              <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
              <FieldError id={`${id}-error`}>{error}</FieldError>
            </Field>
          )
        })}
      </FieldGroup>
      {formError && <FormAlert>{formError}</FormAlert>}
      <Button
        type="submit"
        className="self-start"
        disabled={pending}
        aria-busy={pending}
      >
        Exclure ce domaine
      </Button>
    </form>
  )
}

function RemoveDomainDialog({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      try {
        const result = await allowDomain(domain)
        if (result.ok) {
          toast.success(`${domain} n'est plus exclu.`)
          setOpen(false)
        } else {
          toast.error(result.message ?? "L'action n'a pas abouti.")
        }
      } catch (error) {
        unstable_rethrow(error)
        toast.error(
          "L'action n'a pas abouti. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2Icon data-icon="inline-start" aria-hidden />
          Retirer<span className="sr-only"> {domain}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ne plus exclure {domain} ?</DialogTitle>
          <DialogDescription>
            Ses liens et ses adresses email seront de nouveau acceptés dans les
            annonces, et affichés aux candidats.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            aria-busy={pending}
            onClick={remove}
          >
            Ne plus exclure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BlockedDomainsManager({
  domains,
  affected,
}: {
  domains: BlockedDomainRow[]
  // Annonces publiées qui mènent à l'un des domaines exclus.
  affected: AffectedOffer[]
}) {
  // Dernier domaine ajouté, et les annonces publiées qui y mènent.
  const [added, setAdded] = useState<{
    domain: string
    affected: AffectedOffer[]
  } | null>(null)

  const affectedBy = (domain: string) =>
    affected.filter((offer) =>
      offer.targets.some((target) => target.domain === domain),
    )

  const columns = columnHelper.columns([
    columnHelper.accessor("domain", {
      header: "Domaine",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.domain}</span>
      ),
    }),
    columnHelper.accessor("reason", {
      header: "Motif",
      cell: ({ row }) => row.original.reason ?? "—",
    }),
    columnHelper.accessor("createdAt", {
      header: "Exclu le",
      cell: ({ row }) => formatDate(row.original.createdAt),
    }),
    columnHelper.display({
      id: "affected",
      header: "Annonces publiées concernées",
      cell: ({ row }) => {
        const offers = affectedBy(row.original.domain)
        return offers.length > 0 ? (
          <div className="flex min-w-56 flex-col gap-1 whitespace-normal">
            <span className="flex items-center gap-1 text-destructive">
              <CircleAlertIcon className="size-4" aria-hidden />
              {offerCount(offers.length)}
            </span>
            <AffectedOffers offers={offers} />
          </div>
        ) : (
          <span className="text-muted-foreground">Aucune</span>
        )
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RemoveDomainDialog domain={row.original.domain} />
        </div>
      ),
    }),
  ])

  const table = useTable({
    features,
    data: domains,
    columns,
    getRowId: (row) => row.domain,
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Aucun lien, email ni source d&rsquo;annonce ne peut mener à un domaine
        exclu. Une annonce déjà publiée qui y renvoie garde sa fiche, mais ce
        lien n&rsquo;est plus affiché aux candidats.
      </p>
      <AddDomainForm
        onAdded={(domain, offers) => setAdded({ domain, affected: offers })}
      />

      {added && (
        <Alert variant={added.affected.length > 0 ? "destructive" : "default"}>
          <CircleAlertIcon aria-hidden />
          <AlertTitle>
            {added.affected.length > 0
              ? `${offerCount(added.affected.length)} mène${added.affected.length > 1 ? "nt" : ""} à ${added.domain}`
              : `Aucune annonce publiée ne mène à ${added.domain}`}
          </AlertTitle>
          {added.affected.length > 0 && (
            <AlertDescription>
              <p>
                Ces liens ne sont plus affichés aux candidats. Remplacez-les par
                un contact direct de l&rsquo;employeur.
              </p>
              <AffectedOffers offers={added.affected} />
            </AlertDescription>
          )}
        </Alert>
      )}

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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top">
                    <FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
