import { and, eq, gte, isNull, or } from "drizzle-orm"

import { assertIsoDate } from "@/domain/offer-activity"
import { db } from "@/lib/db"
import { offers } from "@/lib/db/schema"

// Offres visibles des candidats au jour `today` (AAAA-MM-JJ, calculé par todayInParis) : la règle
// isActive de src/domain/offer-activity.ts, évaluée en SQL. Toute lecture côté candidat passe par
// ce fragment : la recherche reste juste même si le job d'expiration (plan 16) n'a pas tourné.
export function activeOfferConditions(today: string) {
  assertIsoDate(today)
  return and(
    eq(offers.status, "published"),
    or(
      isNull(offers.applicationDeadline),
      gte(offers.applicationDeadline, today),
    ),
    or(isNull(offers.endDate), gte(offers.endDate, today)),
  )
}

// Forme acceptée par une colonne uuid : un identifiant mal formé ne doit pas faire échouer la requête.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// L'offre, active ou non, avec son entreprise, son métier, son département et sa région.
// Coordonnées comprises : c'est à l'appelant de décider ce qu'il en montre.
export async function getOfferWithRelations(id: string) {
  if (!UUID.test(id)) return undefined
  return db.query.offers.findFirst({
    where: eq(offers.id, id),
    with: {
      company: true,
      occupation: true,
      department: { with: { region: true } },
    },
  })
}
