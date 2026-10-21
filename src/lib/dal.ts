import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { REQUEST_PATH_HEADER, signInPath } from "@/domain/redirects"
import { homePathFor, isRole, type Role } from "@/domain/roles"
import { auth } from "@/lib/auth"

// Session vérifiée en base, une seule fois par rendu. C'est ici, et non dans le proxy,
// que se décide l'accès.
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const { role } = session.user
  if (!isRole(role)) {
    throw new Error(`Rôle inconnu pour l'utilisateur ${session.user.id}.`)
  }
  return { ...session, user: { ...session.user, role } }
})

export async function requireUser() {
  const session = await getSession()
  if (!session) {
    redirect(signInPath((await headers()).get(REQUEST_PATH_HEADER)))
  }
  return session
}

// Un rôle non autorisé repart vers son propre accueil.
export async function requireRole(...allowed: Role[]) {
  const session = await requireUser()
  if (!allowed.includes(session.user.role)) {
    redirect(homePathFor(session.user.role))
  }
  return session
}

// Pour une route d'API : un refus est une réponse HTTP (401, 403), pas une redirection.
export async function authorizeRoute(...allowed: Role[]) {
  const session = await getSession()
  if (!session) {
    return {
      session: null,
      denied: Response.json({ error: "Connexion requise." }, { status: 401 }),
    }
  }
  if (!allowed.includes(session.user.role)) {
    return {
      session: null,
      denied: Response.json({ error: "Accès refusé." }, { status: 403 }),
    }
  }
  return { session, denied: null }
}
