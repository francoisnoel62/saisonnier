import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SourceForm } from "@/components/admin/scan/sources/source-form"
import { todayInParis } from "@/domain/offer-activity"
import { sourceFormDefaults } from "@/domain/scan/source-form"
import { env } from "@/lib/env"
import { loadScanSource } from "@/server/scan/sources/registry"

export const metadata: Metadata = { title: "Modifier une source" }
// « Tester ces réglages » lance un échantillon depuis ce déploiement.
export const maxDuration = 120

export default async function EditScanSourcePage({
  params,
}: PageProps<"/admin/scan/sources/[key]/modifier">) {
  const { key } = await params
  const source = await loadScanSource(key)
  if (!source || source.row.status === "archived") notFound()
  const { row, revision } = source
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link className="underline" href={`/admin/scan/sources/${key}`}>
          ← {row.label}
        </Link>
      </nav>
      <h2 className="text-xl font-semibold wrap-anywhere">
        Modifier « {row.label} »
      </h2>
      {row.status === "ready" && (
        <p className="text-sm">
          Source prête : une modification de ce qui est lu (connecteur,
          paramètres) exige un échantillon réussi de la nouvelle configuration,
          depuis moins d’une heure.
        </p>
      )}
      <SourceForm
        source={{
          key,
          label: row.label,
          version: row.version,
          status: row.status,
          kind: row.kind,
        }}
        defaultValues={sourceFormDefaults(revision.definition)}
        today={todayInParis(new Date())}
        testOrigin={env.SCAN_TEST_SOURCE_URL}
      />
    </div>
  )
}
