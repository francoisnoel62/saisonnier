import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { auth } from "@/lib/auth"

// Client navigateur : même origine que l'application, d'où l'absence de baseURL.
// Le rôle y est en lecture seule (input: false côté serveur).
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
})
