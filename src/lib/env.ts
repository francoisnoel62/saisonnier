import { z } from "zod"

// Variables serveur, validées au premier import : une variable manquante fait échouer le démarrage.
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Poolée sur Vercel (Neon) ; Docker en local.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
})

function parseServerEnv() {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Variables d'environnement invalides ou manquantes :\n${z.prettifyError(result.error)}\nVoir .env.example.`,
    )
  }
  return result.data
}

export const env = parseServerEnv()
