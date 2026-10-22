import Link from "next/link"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { site } from "@/config/site"

// Indicateurs d'un tableau de bord (bloc dashboard-01), alimentés par des requêtes réelles.
export type SectionCard = {
  label: string
  value: number
  description: string
  href?: string
}

const count = new Intl.NumberFormat(site.locale)

export function SectionCards({ cards }: { cards: SectionCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {count.format(card.value)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm text-muted-foreground">
            {card.href ? (
              <Link
                href={card.href}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {card.description}
              </Link>
            ) : (
              card.description
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
