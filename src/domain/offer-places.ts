export const MAX_EXTRA_LOCATIONS = 20

export type PlaceSource = {
  communeName: string
  communeInseeCode?: string | null
  postalCode?: string | null
  departmentCode: string
  locationDetails?: string | null
  department?: {
    code: string
    name: string
    region?: { name: string } | null
  } | null
}
export type OfferPlace = {
  communeName: string
  communeInseeCode: string | null
  postalCode: string | null
  departmentCode: string
  locationDetails: string | null
  department: { code: string; name: string } | null
  regionName: string | null
}

export function duplicatePlaceIndices(
  primary: PlaceSource,
  extras: readonly PlaceSource[],
) {
  const names = new Set<string>()
  const codes = new Set<string>()
  const duplicates: number[] = []
  for (const [index, place] of [primary, ...extras].entries()) {
    const name = `${place.departmentCode}:${place.communeName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ")}`
    if (
      names.has(name) ||
      (place.communeInseeCode && codes.has(place.communeInseeCode))
    )
      duplicates.push(index - 1)
    names.add(name)
    if (place.communeInseeCode) codes.add(place.communeInseeCode)
  }
  return duplicates
}

// Projection explicite : aucun autre champ de l'annonce ne rejoint la liste des lieux.
export function offerPlaces(
  offer: PlaceSource,
  extraLocations: readonly (PlaceSource & { position: number })[] = [],
): OfferPlace[] {
  return [
    offer,
    ...[...extraLocations].sort((a, b) => a.position - b.position),
  ].map((place) => ({
    communeName: place.communeName,
    communeInseeCode: place.communeInseeCode ?? null,
    postalCode: place.postalCode ?? null,
    departmentCode: place.departmentCode,
    locationDetails: place.locationDetails ?? null,
    department: place.department
      ? { code: place.department.code, name: place.department.name }
      : null,
    regionName: place.department?.region?.name ?? null,
  }))
}

export function otherPlacesLabel(count: number) {
  return count > 0
    ? ` et ${count} autre${count > 1 ? "s" : ""} lieu${count > 1 ? "x" : ""}`
    : ""
}
export function placesSummary(places: readonly OfferPlace[]) {
  const main = places[0]
  if (!main) return "Lieu non précisé"
  const department = main.department
    ? `${main.department.name} (${main.departmentCode})`
    : main.departmentCode
  return `${main.communeName} · ${department}${otherPlacesLabel(places.length - 1)}`
}
