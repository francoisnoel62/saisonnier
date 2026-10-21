// Passe en admin un compte existant dont l'email est vérifié (H1). Aucun email d'admin n'est
// codé en dur : le compte se crée d'abord par l'inscription, puis :
//   npm run admin:grant -- <email>
// Sur une autre base (preview, production), fournir sa URL : la variable prime sur les fichiers .env.
//   DATABASE_URL=… npm run admin:grant -- <email>
// Import par défaut : tsx charge ce script en ESM natif (@next/env est en CommonJS).
import nextEnv from "@next/env"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { user } from "@/lib/db/schema"

// Mêmes fichiers .env et mêmes priorités que Next (.env.development.local en local).
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")

const email = process.argv[2]?.trim().toLowerCase()
const url = process.env.DATABASE_URL
if (!email || !url) {
  console.error(
    !email
      ? "Usage : npm run admin:grant -- <email>"
      : "DATABASE_URL manquante : voir .env.example.",
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const db = drizzle({ client: pool, casing: "snake_case" })

try {
  const [account] = await db
    .select({ id: user.id, role: user.role, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))

  if (!account) {
    console.error(`Aucun compte pour ${email} : inscrivez-vous d'abord.`)
    process.exitCode = 1
  } else if (!account.emailVerified) {
    console.error(
      `L'adresse ${email} n'est pas vérifiée : ouvrez d'abord le lien de confirmation.`,
    )
    process.exitCode = 1
  } else if (account.role === "admin") {
    console.info(`${email} est déjà admin.`)
  } else {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, account.id))
    console.info(`${email} : ${account.role} → admin.`)
  }
} finally {
  await pool.end()
}
