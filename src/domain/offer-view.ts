export const offerViews = ["escales", "comparateur", "immersion"] as const
export type OfferView = (typeof offerViews)[number]
export function offerView(value: unknown): OfferView {
  return offerViews.find((view) => view === value) ?? "escales"
}
export function withOfferView(
  href: string,
  view: OfferView,
  selected?: string,
) {
  const url = new URL(href, "https://ma-saison.fr")
  if (view !== "escales") url.searchParams.set("vue", view)
  else url.searchParams.delete("vue")
  if (selected && view === "immersion") url.searchParams.set("offre", selected)
  else url.searchParams.delete("offre")
  return url.pathname + url.search
}
// Le retour d'une fiche ne peut pointer que vers le catalogue interne.
export function offersReturnHref(value: unknown) {
  if (typeof value !== "string" || !/^\/offres(?:\?|$)/.test(value))
    return "/offres"
  return value
}
