import { redirect } from "next/navigation"

import { homePathFor } from "@/domain/roles"
import { requireUser } from "@/lib/dal"

// Aiguillage après connexion et après vérification de l'email (callbackURL de Better Auth).
export default async function AfterSignInPage({
  searchParams,
}: PageProps<"/apres-connexion">) {
  // Lien de vérification expiré ou invalide : Better Auth ajoute ?error=…
  const { error } = await searchParams
  if (error) redirect("/verification-email?lien=invalide")

  const { user } = await requireUser()
  redirect(homePathFor(user.role))
}
