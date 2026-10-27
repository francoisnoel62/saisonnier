import "server-only"

import { eq } from "drizzle-orm"
import type { ExtraLocationInput } from "@/domain/offer-input"
import type { db } from "@/lib/db"
import { offerLocations } from "@/lib/db/schema"

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Toujours dans la transaction de l'annonce : une lecture ne voit jamais une liste partielle.
export async function replaceOfferLocations(
  tx: Transaction,
  offerId: string,
  locations: readonly ExtraLocationInput[] = [],
) {
  await tx.delete(offerLocations).where(eq(offerLocations.offerId, offerId))
  if (locations.length)
    await tx.insert(offerLocations).values(
      locations.map((place, index) => ({
        offerId,
        position: index + 1,
        communeName: place.communeName,
        communeInseeCode: place.communeInseeCode,
        postalCode: place.postalCode,
        departmentCode: place.departmentCode,
        locationDetails: place.locationDetails,
      })),
    )
}
