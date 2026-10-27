"use client"

import { unstable_rethrow } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  sampleFields,
  type ExtractionSample,
  type SampleField,
} from "@/domain/scan/sample"
import { sampleScanSourceAction } from "@/server/scan/actions"

const fieldLabels: Record<SampleField, string> = {
  contract: "Contrat",
  period: "Période",
  locations: "Lieu",
  application: "Candidature",
  salary: "Salaire",
}
export function ScanSampleButton({
  source,
}: {
  source: { key: string; label: string }
}) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ExtractionSample | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement>(null)
  function sample() {
    setOpen(true)
    setResult(null)
    setError(null)
    startTransition(async () => {
      try {
        const response = await sampleScanSourceAction(source.key)
        if (response.ok) setResult(response.result)
        else setError(response.message)
      } catch (error) {
        unstable_rethrow(error)
        setError("L’extraction n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }
  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        disabled={pending}
        className="h-auto w-full whitespace-normal sm:w-fit"
        onClick={sample}
      >
        Extraire un échantillon
        <span className="sr-only"> — {source.label}</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <SheetHeader>
            <SheetTitle>Échantillon — {source.label}</SheetTitle>
            <SheetDescription>
              Dix fiches au plus, sans enregistrement d’annonce ou de dossier.
            </SheetDescription>
          </SheetHeader>
          <div
            className="grid gap-4 px-4 pb-6 text-sm"
            aria-live="polite"
            aria-busy={pending}
          >
            {pending && <p>Extraction de l’échantillon en cours…</p>}
            {error && <p role="alert">{error}</p>}
            {result && (
              <>
                <p className="wrap-anywhere">
                  Déploiement : {result.deploymentUrl}
                  <br />
                  {result.sampledAt} · {result.extractorVersion}
                </p>
                {result.failure && (
                  <p role="alert">Lecture interrompue : {result.failure}</p>
                )}
                <section>
                  <h3 className="font-medium">
                    Champs établis dans l’échantillon
                  </h3>
                  <ul>
                    {sampleFields.map((field) => (
                      <li key={field}>
                        {fieldLabels[field]} :{" "}
                        {result.coverage[field].established}/
                        {result.coverage[field].total}
                      </li>
                    ))}
                  </ul>
                </section>
                {result.items.map((item, index) => (
                  <section
                    key={`${item.url}-${index}`}
                    className="grid gap-2 rounded-lg border p-3"
                  >
                    <h3 className="font-medium">{item.title}</h3>
                    {item.companyName && <p>Employeur : {item.companyName}</p>}
                    <a
                      className="wrap-anywhere underline"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      Fiche source
                    </a>
                    <dl>
                      {sampleFields.map((field) => (
                        <div key={field} className="grid gap-1 py-1">
                          <dt className="font-medium">{fieldLabels[field]}</dt>
                          <dd>{item.fields[field].text}</dd>
                        </div>
                      ))}
                    </dl>
                    {item.issues.length > 0 && (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {item.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
