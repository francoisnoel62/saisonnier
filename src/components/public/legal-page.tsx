import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Gabarit des pages légales : titre, bandeau de brouillon, puis sections de texte.
export function LegalPage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Alert role="note">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>Brouillon à valider</AlertTitle>
        <AlertDescription>
          Ce texte décrit la première version du service. Il doit être relu et
          complété avant la mise en production.
        </AlertDescription>
      </Alert>
      {children}
    </article>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-muted-foreground [&_li]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  )
}

// Information que le fondateur doit encore renseigner.
export function ToComplete({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-yellow-200 px-1 text-foreground dark:bg-yellow-900">
      [{children}]
    </mark>
  )
}
