import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { FormAlert } from "@/components/auth/form-alert"
import { SignInForm } from "@/components/auth/sign-in-form"
import { safeNextPath } from "@/domain/redirects"

export const metadata: Metadata = { title: "Connexion" }

export default async function SignInPage({
  searchParams,
}: PageProps<"/connexion">) {
  const { next, reinitialise } = await searchParams

  return (
    <AuthCard
      title="Connexion"
      description="Un compte est nécessaire pour consulter les offres."
    >
      <div className="flex flex-col gap-6">
        {reinitialise === "1" && (
          <FormAlert variant="success">
            Votre mot de passe a été modifié. Connectez-vous avec le nouveau.
          </FormAlert>
        )}
        <SignInForm next={safeNextPath(next)} />
      </div>
    </AuthCard>
  )
}
