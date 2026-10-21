import { drizzle } from "drizzle-orm/node-postgres"
import type { Pool } from "pg"

import { todayInParis } from "../../src/domain/offer-activity"
import { offerCountLabel } from "../../src/domain/offer-display"
import { matchesCriteria } from "../../src/domain/offer-matching"
import type { SearchCriteria } from "../../src/domain/search-criteria"
import * as schema from "../../src/lib/db/schema"
import { demoOffers, seedDemo } from "../../src/lib/db/seed/demo-data"

// Catalogue de la recherche : le jeu de démonstration seul, daté d'aujourd'hui. Les compteurs
// attendus viennent de l'oracle du plan 08 (matchesCriteria), jamais d'une valeur recopiée.
export async function seedDemoCatalog(db: Pool) {
  const today = todayInParis(new Date())
  await db.query("delete from offers")
  await seedDemo(drizzle({ client: db, schema, casing: "snake_case" }), today)

  const { rows } = await db.query<{ code: string; region_code: string }>(
    "select code, region_code from departments",
  )
  const regionOf = new Map(rows.map((row) => [row.code, row.region_code]))
  const offers = demoOffers(today).map((offer) => ({
    ...offer,
    regionCode: regionOf.get(offer.departmentCode)!,
  }))
  const matching = (criteria: SearchCriteria) =>
    offers.filter((offer) => matchesCriteria(offer, criteria, today))

  return {
    offers,
    matching,
    // Texte du compteur de résultats pour ces critères : « 12 offres ».
    countLabel: (criteria: SearchCriteria) =>
      offerCountLabel(matching(criteria).length),
  }
}

export type DemoCatalog = Awaited<ReturnType<typeof seedDemoCatalog>>
