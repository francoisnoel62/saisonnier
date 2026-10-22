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
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
} from "lucide-react"
import { unstable_rethrow } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { Badge } from "@/components/ui/badge"
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
import { occupationLimits, type OccupationInput } from "@/domain/occupation"
import {
  createOccupation,
  editOccupation,
  reorderOccupation,
  toggleOccupation,
  type ReferentialResult,
} from "@/server/referentials/actions"

// Métiers du référentiel (§4) : ajouter, renommer, ordonner, désactiver (plan 15).

export type OccupationRow = {
  id: string
  slug: string
  label: string
  family: string
  isActive: boolean
  offerCount: number
}

const features = tableFeatures({ columnVisibilityFeature })

const columnHelper = createColumnHelper<typeof features, OccupationRow>()

const FAMILIES_LIST = "familles-metiers"

// Une action à la fois ; un échec s'affiche tel que le serveur le formule.
function useReferentialAction() {
  const [pending, startTransition] = useTransition()
  function run(
    action: () => Promise<ReferentialResult>,
    success: string,
    onDone?: () => void,
  ) {
    if (pending) return
    startTransition(async () => {
      try {
        const result = await action()
        if (result.ok) {
          toast.success(success)
          onDone?.()
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
  return { pending, run }
}

// Intitulé et famille d'un métier, pour l'ajout comme pour le renommage.
function OccupationFields({
  idPrefix,
  values,
  onChange,
  errors,
}: {
  idPrefix: string
  values: OccupationInput
  onChange: (values: OccupationInput) => void
  errors: Partial<Record<keyof OccupationInput, string[]>>
}) {
  const fields = [
    {
      name: "label",
      label: "Intitulé du métier",
      hint: "Par exemple : Serveur / serveuse.",
      maxLength: occupationLimits.label,
    },
    {
      name: "family",
      label: "Famille",
      hint: "Les métiers sont groupés par famille dans les formulaires et les filtres.",
      maxLength: occupationLimits.family,
    },
  ] as const
  return (
    <>
      {fields.map(({ name, label, hint, maxLength }) => {
        const id = `${idPrefix}-${name}`
        const error = errors[name]?.[0]
        return (
          <Field key={name} data-invalid={!!error}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              id={id}
              value={values[name]}
              maxLength={maxLength}
              autoComplete="off"
              list={name === "family" ? FAMILIES_LIST : undefined}
              onChange={(event) =>
                onChange({ ...values, [name]: event.target.value })
              }
              aria-invalid={!!error}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            />
            <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
            <FieldError id={`${id}-error`}>{error}</FieldError>
          </Field>
        )
      })}
    </>
  )
}

function AddOccupationForm() {
  const empty = { label: "", family: "" }
  const [values, setValues] = useState<OccupationInput>(empty)
  const [errors, setErrors] = useState<
    Partial<Record<keyof OccupationInput, string[]>>
  >({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    startTransition(async () => {
      try {
        const result = await createOccupation(values)
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          setFormError(result.message ?? null)
          return
        }
        toast.success(`Métier « ${values.label.trim()} » ajouté.`)
        setValues(empty)
        setErrors({})
      } catch (error) {
        unstable_rethrow(error)
        setFormError(
          "Le métier n'a pas été ajouté. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h3 className="font-medium">Ajouter un métier</h3>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <OccupationFields
          idPrefix="nouveau-metier"
          values={values}
          onChange={setValues}
          errors={errors}
        />
      </FieldGroup>
      {formError && <FormAlert>{formError}</FormAlert>}
      <Button
        type="submit"
        className="self-start"
        disabled={pending}
        aria-busy={pending}
      >
        Ajouter le métier
      </Button>
    </form>
  )
}

function EditOccupationDialog({ row }: { row: OccupationRow }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<OccupationInput>({
    label: row.label,
    family: row.family,
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof OccupationInput, string[]>>
  >({})
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await editOccupation(row.id, values)
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          if (result.message) toast.error(result.message)
          return
        }
        toast.success("Métier modifié.")
        setErrors({})
        setOpen(false)
      } catch (error) {
        unstable_rethrow(error)
        toast.error(
          "La modification n'a pas abouti. Vérifiez votre connexion et réessayez.",
        )
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValues({ label: row.label, family: row.family })
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PencilIcon data-icon="inline-start" aria-hidden />
          Modifier<span className="sr-only"> : {row.label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Modifier le métier</DialogTitle>
            <DialogDescription>
              Son identifiant dans les liens de recherche ne change pas (
              {row.slug}).
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <OccupationFields
              idPrefix={`metier-${row.id}`}
              values={values}
              onChange={setValues}
              errors={errors}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RowActions({ row }: { row: OccupationRow }) {
  const { pending, run } = useReferentialAction()
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <EditOccupationDialog row={row} />
      <Button
        variant="ghost"
        size="sm"
        aria-busy={pending}
        onClick={() =>
          run(
            () => toggleOccupation(row.id, !row.isActive),
            row.isActive
              ? `« ${row.label} » est désactivé : il n'est plus proposé.`
              : `« ${row.label} » est de nouveau proposé.`,
          )
        }
      >
        {row.isActive ? (
          <EyeOffIcon data-icon="inline-start" aria-hidden />
        ) : (
          <EyeIcon data-icon="inline-start" aria-hidden />
        )}
        {row.isActive ? "Désactiver" : "Réactiver"}
        <span className="sr-only"> : {row.label}</span>
      </Button>
    </div>
  )
}

function OrderButtons({
  row,
  first,
  last,
}: {
  row: OccupationRow
  first: boolean
  last: boolean
}) {
  const { pending, run } = useReferentialAction()
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={first}
        aria-busy={pending}
        onClick={() =>
          run(() => reorderOccupation(row.id, "up"), `« ${row.label} » monté.`)
        }
      >
        <ArrowUpIcon aria-hidden />
        <span className="sr-only">Monter « {row.label} »</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={last}
        aria-busy={pending}
        onClick={() =>
          run(
            () => reorderOccupation(row.id, "down"),
            `« ${row.label} » descendu.`,
          )
        }
      >
        <ArrowDownIcon aria-hidden />
        <span className="sr-only">Descendre « {row.label} »</span>
      </Button>
    </div>
  )
}

export function OccupationsManager({
  occupations,
  families,
}: {
  occupations: OccupationRow[]
  families: string[]
}) {
  const columns = columnHelper.columns([
    columnHelper.display({
      id: "order",
      header: "Ordre",
      cell: ({ row }) => (
        <OrderButtons
          row={row.original}
          first={row.index === 0}
          last={row.index === occupations.length - 1}
        />
      ),
    }),
    columnHelper.accessor("label", {
      header: "Métier",
      cell: ({ row }) => (
        <span className="block min-w-40 font-medium whitespace-normal">
          {row.original.label}
        </span>
      ),
    }),
    columnHelper.accessor("family", { header: "Famille" }),
    columnHelper.accessor("offerCount", {
      header: "Annonces",
      cell: ({ row }) => row.original.offerCount,
    }),
    columnHelper.accessor("isActive", {
      header: "Statut",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary">Proposé</Badge>
        ) : (
          <Badge variant="outline">Désactivé</Badge>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions row={row.original} />,
    }),
  ])

  const table = useTable({
    features,
    data: occupations,
    columns,
    getRowId: (row) => row.id,
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Un métier désactivé disparaît des formulaires d&rsquo;annonce et des
        filtres de la recherche, mais reste affiché sur les annonces qui le
        citent.
      </p>
      <datalist id={FAMILIES_LIST}>
        {families.map((family) => (
          <option key={family} value={family} />
        ))}
      </datalist>
      <AddOccupationForm />
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
              <TableRow
                key={row.id}
                data-inactive={!row.original.isActive}
                className="data-[inactive=true]:text-muted-foreground"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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
