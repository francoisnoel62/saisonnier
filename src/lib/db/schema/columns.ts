import { sql } from "drizzle-orm"
import { timestamp, type AnyPgColumn } from "drizzle-orm/pg-core"

// Colonnes et règles partagées par les tables métier.

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// Pour une contrainte CHECK : chaque texte est absent (NULL) ou renseigné. Une chaîne vide ou
// faite d'espaces ne vaut pas une information ; l'absence s'écrit NULL.
export function notBlank(...columns: AnyPgColumn[]) {
  return sql.join(
    columns.map(
      (column) => sql`(${column} is null or ${column} ~ '[^[:space:]]')`,
    ),
    sql` and `,
  )
}
