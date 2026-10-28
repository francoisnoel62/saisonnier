"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { adapterCatalog } from "@/domain/scan/adapter-catalog"
import type { ScanSourceSummary } from "@/domain/scan/source"
import {
  scanSourceKindLabels,
  scanSourceRoleLabels,
  scanSourceStatusLabels,
} from "@/domain/scan/vocabulary"

import { SourceEditLink, useSourceLifecycle } from "./source-lifecycle"
import { ScanSourceSwitches } from "./source-switches"
import { SourceTestButtons } from "./source-test"
import { statusVariant } from "./sources-table"

// En-tête de la fiche (§11.3) : identité, statut, interrupteurs motivés, tests, cycle de vie.
export function SourceHeader({
  source,
  pendingCandidates,
  rejectionReason,
}: {
  source: ScanSourceSummary
  pendingCandidates: number
  rejectionReason: string | null
}) {
  const lifecycle = useSourceLifecycle({ ...source, pendingCandidates })
  const descriptor = source.adapter ? adapterCatalog[source.adapter] : null
  return (
    <header className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold wrap-anywhere">{source.label}</h2>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{scanSourceKindLabels[source.kind]}</Badge>
          <Badge variant={statusVariant[source.status]}>
            {scanSourceStatusLabels[source.status]}
          </Badge>
          <Badge variant="outline">
            {descriptor
              ? (descriptor.version ?? descriptor.label)
              : "Connecteur à déterminer"}
          </Badge>
          <Badge variant="outline">{scanSourceRoleLabels[source.role]}</Badge>
          {source.suspended && <Badge variant="destructive">Suspendue</Badge>}
        </div>
        {rejectionReason && (
          <p className="text-sm wrap-anywhere">Écartée : {rejectionReason}</p>
        )}
      </div>
      {source.status !== "rejected" && source.status !== "archived" && (
        <ScanSourceSwitches source={source} />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {source.testable && <SourceTestButtons source={source} />}
        {source.status !== "archived" && (
          <SourceEditLink sourceKey={source.key} />
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {source.status === "ready" && (
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            disabled={lifecycle.pending}
            onClick={() => lifecycle.request("back_to_draft")}
          >
            Repasser en brouillon
          </Button>
        )}
        {(source.status === "draft" || source.status === "ready") && (
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            disabled={lifecycle.pending}
            onClick={() => lifecycle.request("reject")}
          >
            Écarter
          </Button>
        )}
        {source.status === "rejected" && (
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            disabled={lifecycle.pending}
            onClick={() => lifecycle.request("reexamine")}
          >
            Réexaminer
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full sm:w-fit"
          disabled={lifecycle.pending}
          onClick={() =>
            lifecycle.request(
              source.status === "archived" ? "restore" : "archive",
            )
          }
        >
          {source.status === "archived" ? "Restaurer" : "Archiver"}
        </Button>
        <Button
          variant="outline"
          className="w-full text-destructive sm:w-fit"
          disabled={lifecycle.pending}
          onClick={() => lifecycle.request("delete")}
        >
          Supprimer
        </Button>
      </div>
      {lifecycle.dialogs}
    </header>
  )
}
