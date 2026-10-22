"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { site } from "@/config/site"

// Activité quotidienne du service (bloc dashboard-01, plan 15) : inscriptions de candidats et
// annonces publiées, alimentées par des requêtes réelles. Deux mesures distinctes : deux
// graphiques d'une seule série, sur une même période, plutôt qu'un graphique à deux échelles.

export type DailyActivityPoint = {
  // Jour à Paris, AAAA-MM-JJ.
  date: string
  candidates: number
  offers: number
}

type Series = "candidates" | "offers"

const seriesTitles: Record<Series, string> = {
  candidates: "Inscriptions de candidats",
  offers: "Annonces publiées",
}

const ranges = [
  { days: "90", label: "90 derniers jours" },
  { days: "30", label: "30 derniers jours" },
  { days: "7", label: "7 derniers jours" },
] as const

type Range = (typeof ranges)[number]["days"]

// Une date de calendrier n'a pas de fuseau : lue et écrite en UTC, elle ne change pas de jour.
const shortDate = new Intl.DateTimeFormat(site.locale, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const longDate = new Intl.DateTimeFormat(site.locale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})
const dayOf = (value: string) => new Date(`${value}T00:00:00Z`)
const number = new Intl.NumberFormat(site.locale)

function DailyAreaChart({
  data,
  series,
}: {
  data: DailyActivityPoint[]
  series: Series
}) {
  const total = data.reduce((sum, point) => sum + point[series], 0)
  const config = {
    [series]: { label: seriesTitles[series], color: "var(--primary)" },
  } satisfies ChartConfig

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{seriesTitles[series]}</span>
        <span className="text-sm text-muted-foreground">
          {number.format(total)} sur la période
        </span>
      </figcaption>
      <ChartContainer
        config={config}
        className="aspect-auto h-[200px] w-full"
        aria-hidden
      >
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value: string) => shortDate.format(dayOf(value))}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const date = payload?.[0]?.payload?.date
                  return typeof date === "string"
                    ? longDate.format(dayOf(date))
                    : null
                }}
                indicator="line"
              />
            }
          />
          <Area
            dataKey={series}
            type="monotone"
            fill={`var(--color-${series})`}
            fillOpacity={0.1}
            stroke={`var(--color-${series})`}
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
    </figure>
  )
}

export function ChartAreaInteractive({ data }: { data: DailyActivityPoint[] }) {
  const isMobile = useIsMobile()
  const [range, setRange] = React.useState<Range>("90")

  // Ajuste la période pendant le rendu plutôt que dans un effet.
  const [prevIsMobile, setPrevIsMobile] = React.useState(isMobile)
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile)
    if (isMobile) {
      setRange("30")
    }
  }

  const visible = data.slice(-Number(range))
  const label = ranges.find((item) => item.days === range)?.label
  const choose = (value: string) => {
    const next = ranges.find((item) => item.days === value)
    if (next) setRange(next.days)
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          <h2>Activité par jour</h2>
        </CardTitle>
        <CardDescription>{label}, heure de Paris</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={choose}
            variant="outline"
            aria-label="Période"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {ranges.map((item) => (
              <ToggleGroupItem key={item.days} value={item.days}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={choose}>
            <SelectTrigger
              className="flex w-44 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Période"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {ranges.map((item) => (
                <SelectItem
                  key={item.days}
                  value={item.days}
                  className="rounded-lg"
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-2 pt-4 sm:px-6">
        <div className="grid gap-6 @[767px]/card:grid-cols-2">
          <DailyAreaChart data={visible} series="candidates" />
          <DailyAreaChart data={visible} series="offers" />
        </div>
        {/* Les mêmes valeurs en tableau : lisibles sans le graphique. */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Afficher les valeurs en tableau
          </summary>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Jour</TableHead>
                  <TableHead className="text-right">
                    {seriesTitles.candidates}
                  </TableHead>
                  <TableHead className="text-right">
                    {seriesTitles.offers}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...visible].reverse().map((point) => (
                  <TableRow key={point.date}>
                    <TableCell>{longDate.format(dayOf(point.date))}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {point.candidates}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {point.offers}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
