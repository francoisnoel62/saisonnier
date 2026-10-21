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
