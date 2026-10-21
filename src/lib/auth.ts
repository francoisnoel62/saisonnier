import { waitUntil } from "@vercel/functions"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { site } from "@/config/site"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { sendEmail } from "@/lib/email/send"
import { resetPasswordEmail, verificationEmail } from "@/lib/email/templates"
import { env } from "@/lib/env"

// Hôtes servis : l'URL publique, plus, sur Vercel, celles du déploiement et de la branche (previews).
const allowedHosts = [
  new URL(env.BETTER_AUTH_URL).host,
  env.VERCEL_URL,
  env.VERCEL_BRANCH_URL,
].filter((host) => host !== undefined)

export const auth = betterAuth({
  appName: site.name,
  secret: env.BETTER_AUTH_SECRET,
  // L'URL de base suit l'hôte de la requête s'il est autorisé, sinon BETTER_AUTH_URL.
  // Les origines de confiance (trustedOrigins) se déduisent de ces mêmes hôtes.
  baseURL: { allowedHosts, fallback: env.BETTER_AUTH_URL },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        ...resetPasswordEmail({ name: user.name, url }),
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        ...verificationEmail({ name: user.name, url }),
      })
    },
  },
  user: {
    additionalFields: {
      // Jamais fourni par le client : candidat par défaut, employeur posé par signUpEmployer,
      // admin par le script admin:grant.
      role: {
        type: "string",
        required: true,
        defaultValue: "candidate",
        input: false,
      },
    },
  },
  advanced: {
    // Les emails partent après la réponse : une inscription répond aussi vite, que l'email
    // soit déjà pris ou non.
    backgroundTasks: { handler: waitUntil },
  },
  // nextCookies doit rester le dernier plugin.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
