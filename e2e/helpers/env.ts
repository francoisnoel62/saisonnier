// Variables de l'E2E : .env.test.local en local, environnement du processus en CI.
// Les valeurs déjà présentes dans l'environnement priment (loadEnvFile ne les écrase pas).
try {
  process.loadEnvFile(".env.test.local")
} catch {
  // Pas de fichier (CI) : tout vient de l'environnement.
}

export const E2E_PORT = 3100
export const E2E_URL = `http://localhost:${E2E_PORT}`

// Transmises au serveur de test ; elles priment sur les fichiers .env* chargés par Next.
const serverVariables = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "EMAIL_FROM",
  "ADMIN_NOTIFICATION_EMAIL",
] as const

export function serverEnv() {
  const missing = serverVariables.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(
      `Variables manquantes pour l'E2E : ${missing.join(", ")} (voir .env.test.local et .env.example).`,
    )
  }
  return {
    ...Object.fromEntries(
      serverVariables.map((name) => [name, process.env[name] as string]),
    ),
    BETTER_AUTH_URL: E2E_URL,
    // Sans clé Resend, les emails s'affichent dans la console du serveur.
    RESEND_API_KEY: "",
    // Distinct de celui du `next dev` habituel (port 3000), qui peut tourner en même temps.
    NEXT_DIST_DIR: ".next-e2e",
    // Documents des candidats sur disque (.storage/), jamais dans le store Vercel Blob.
    STORAGE_DRIVER: "local",
    // Copie des emails affichés en console, lue par les tests (helpers/outbox.ts).
    EMAIL_OUTBOX_DIR: ".e2e-outbox",
  }
}
