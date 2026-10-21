import { and, count, desc, eq, gte } from "drizzle-orm"

import { db } from "@/lib/db"
import { contactMessages } from "@/lib/db/schema"

const HOUR_MS = 60 * 60 * 1000

// Messages déjà reçus de cette adresse sur la dernière heure : base de la limitation de débit.
export async function countRecentMessages(email: string, now = new Date()) {
  const [row] = await db
    .select({ value: count() })
    .from(contactMessages)
    .where(
      and(
        eq(contactMessages.email, email),
        gte(contactMessages.createdAt, new Date(now.getTime() - HOUR_MS)),
      ),
    )
  return row.value
}

export async function listContactMessages() {
  return db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
}
