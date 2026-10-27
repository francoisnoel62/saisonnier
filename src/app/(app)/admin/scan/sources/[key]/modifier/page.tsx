import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SourceForm } from "@/components/admin/scan/sources/source-form"
import { todayInParis } from "@/domain/offer-activity"
import { sourceFormDefaults } from "@/domain/scan/source-form"
import { env } from "@/lib/env"
import { sourceQualification } from "@/server/scan/sources/qualification"
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
  // Brouillon : la page guide la suite de l'ajout (§11.4).
  const items =
    row.status === "draft" ? await sourceQualification(row, revision) : []
  const done = (...codes: string[]) =>
    codes.every((code) =>
      items.some((item) => item.code === code && item.state !== "missing"),
    )
  const steps = [
    { label: "Type et identité", done: done("identity") },
    { label: "Connecteur et paramètres", done: done("adapter") },
    {
      label: "Preuves et conditions",
      done: done("affiliation", "reuse_terms"),
    },
    { label: "Échantillon réussi", done: done("tested") },
    { label: "Décision de reprise", done: done("reuse_decision") },
    { label: "Marquer comme prête", done: false },
  ]
  const current = steps.findIndex((step) => !step.done)
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
      {row.status === "draft" && (
        <section
          aria-labelledby="steps-title"
          className="rounded-lg border p-4"
        >
          <h3 id="steps-title" className="font-medium">
            Étape {current + 1} sur {steps.length} : {steps[current].label}
          </h3>
          <ol className="mt-2 list-inside list-decimal text-sm">
            {steps.map((step, index) => (
              <li
                key={step.label}
                aria-current={index === current ? "step" : undefined}
                className={index === current ? "font-medium" : undefined}
              >
                {step.label}
                {step.done ? " — fait" : ""}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-muted-foreground">
            Le test, la décision et « Marquer comme prête » se font depuis la
            fiche de la source.
          </p>
        </section>
      )}
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
