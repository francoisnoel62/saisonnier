import { ConstructionIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Page squelette d'une entrée de menu, remplacée par les plans 08 à 17.
export function ComingSoon({ children }: { children?: React.ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ConstructionIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Bientôt disponible</EmptyTitle>
        <EmptyDescription>
          {children ?? "Cette page est en cours de construction."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
