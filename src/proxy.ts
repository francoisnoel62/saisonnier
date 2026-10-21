import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { REQUEST_PATH_HEADER, signInPath } from "@/domain/redirects"

// Redirection optimiste : seule la présence du cookie de session est testée, sans requête en base.
// L'autorisation réelle (session valide, rôle) reste dans la DAL (src/lib/dal.ts).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const path = `${pathname}${search}`

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(signInPath(path), request.url))
  }

  // La DAL renverra vers cette page après connexion si la session s'avère expirée.
  const headers = new Headers(request.headers)
  headers.set(REQUEST_PATH_HEADER, path)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    "/offres/:path*",
    "/mes-offres/:path*",
    "/dossier/:path*",
    "/compte/:path*",
    "/employeur/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
  ],
}
