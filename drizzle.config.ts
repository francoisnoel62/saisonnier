// Import nommé : drizzle-kit charge ce fichier via esbuild (interop CommonJS).
import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

// Mêmes fichiers .env et mêmes priorités que Next (.env.development.local en local).
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")

// Les migrations passent par la connexion directe, pas par le pooler Neon.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  throw new Error("DATABASE_URL manquante : voir .env.example.")
}

export default defineConfig({
  schema: "./src/lib/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
