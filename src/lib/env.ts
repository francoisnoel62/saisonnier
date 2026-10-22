import { z } from "zod"

// Variables serveur, validées au premier import : une variable manquante fait échouer le démarrage.
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Poolée sur Vercel (Neon) ; Docker en local.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  // Better Auth : secret de signature (openssl rand -base64 32) et URL publique de l'application.
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  // Injectées par Vercel (sans protocole) : hôtes de la preview, acceptés en plus de BETTER_AUTH_URL.
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),

  // Emails : sans clé Resend (en local), ils s'affichent dans la console.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email(),
  // Boîte du fondateur, destinataire des notifications du service.
  ADMIN_NOTIFICATION_EMAIL: z.email(),
  // Sans clé Resend : copie de chaque email affiché en console dans ce dossier (un fichier JSON
  // par email). L'E2E y lit les emails envoyés.
  EMAIL_OUTBOX_DIR: z.string().optional(),

  // Documents des candidats : Vercel Blob privé, ou disque local (.storage/) pour l'E2E.
  STORAGE_DRIVER: z.enum(["vercel-blob", "local"]).default("vercel-blob"),
  // Injecté par Vercel une fois le store connecté ; lu directement par @vercel/blob.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
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
