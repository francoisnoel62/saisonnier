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
import type { SourceFormValues } from "@/domain/scan/source-form"
import { testScanSourceAction } from "@/server/scan/sources/actions"
import type {
  SourceTestKind,
  SourceTestOutcome,
} from "@/server/scan/sources/tests"

import { ProbeResultView, SampleResultView } from "./test-results"

type Outcome = Extract<SourceTestOutcome, { ok: true }>

// Sonde ou échantillon depuis ce déploiement, dans un panneau. Le résultat est conservé dans
// l'onglet « Tests » de la source ; le focus revient au bouton à la fermeture.
export function useSourceTest(source: { key: string; label: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<SourceTestKind>("probe")
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const trigger = useRef<HTMLElement | null>(null)

  function run(
    nextKind: SourceTestKind,
    from: HTMLElement | null,
    {
      values,
      onDone,
      onFieldErrors,
    }: {
      values?: SourceFormValues
      onDone?: (outcome: Outcome) => void
      onFieldErrors?: (errors: Record<string, string[]>) => void
    } = {},
  ) {
    if (pending) return
    trigger.current = from
    setKind(nextKind)
    setOutcome(null)
    setError(null)
    setOpen(true)
    startTransition(async () => {
      try {
        const response = await testScanSourceAction(
          source.key,
          nextKind,
          values,
        )
        if (response.ok) {
          setOutcome(response)
          onDone?.(response)
        } else {
          setError(response.message)
          if ("fieldErrors" in response && response.fieldErrors)
            onFieldErrors?.(response.fieldErrors)
        }
      } catch (error) {
        unstable_rethrow(error)
        setError("Le test n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }

  const sheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          trigger.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {kind === "probe" ? "Diagnostic" : "Échantillon"} — {source.label}
          </SheetTitle>
          <SheetDescription>
            {kind === "probe"
              ? "Liste et jusqu’à trois fiches, selon l’accès autorisé par la source."
              : "Dix fiches au plus, sans enregistrement d’annonce ou de dossier."}
          </SheetDescription>
        </SheetHeader>
        <div
          className="flex flex-col gap-4 px-4 pb-6 text-sm"
          aria-live="polite"
          aria-busy={pending}
        >
          {pending && (
            <p>
              {kind === "probe"
                ? "Lecture de la source en cours…"
                : "Extraction de l’échantillon en cours…"}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {outcome && (
            <p>
              {outcome.succeeded ? "Test réussi" : "Test en échec"} ·
              configuration testée {outcome.configHash.slice(0, 8)}
            </p>
          )}
          {outcome?.kind === "probe" && (
            <ProbeResultView result={outcome.result} />
          )}
          {outcome?.kind === "sample" && (
            <SampleResultView result={outcome.result} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
  return { run, pending, sheet }
}

export function SourceTestButtons({
  source,
}: {
  source: { key: string; label: string }
}) {
  const test = useSourceTest(source)
  return (
    <>
      <Button
        variant="outline"
        className="h-auto w-full whitespace-normal sm:w-fit"
        disabled={test.pending}
        onClick={(event) => test.run("probe", event.currentTarget)}
      >
        Tester l’accès
        <span className="sr-only"> — {source.label}</span>
      </Button>
      <Button
        variant="outline"
        className="h-auto w-full whitespace-normal sm:w-fit"
        disabled={test.pending}
        onClick={(event) => test.run("sample", event.currentTarget)}
      >
        Extraire un échantillon
        <span className="sr-only"> — {source.label}</span>
      </Button>
      {test.sheet}
    </>
  )
}
