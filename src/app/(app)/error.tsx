"use client"

import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function AppError({
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Une erreur est survenue</EmptyTitle>
        <EmptyDescription>
          Cette page n&rsquo;a pas pu s&rsquo;afficher. Réessayez dans quelques
          instants.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => retry()}>Réessayer</Button>
      </EmptyContent>
    </Empty>
  )
}
