import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { FormAlert } from "@/components/auth/form-alert"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "Nouveau mot de passe" }

// Better Auth redirige ici depuis le lien de l'email : ?token=… si le lien est valide,
// ?error=INVALID_TOKEN sinon.
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reinitialiser-mot-de-passe">) {
  const { token, error } = await searchParams

  if (error || typeof token !== "string" || !token) {
    return (
      <AuthCard title="Lien expiré">
        <div className="flex flex-col gap-6">
          <FormAlert>
            Ce lien de réinitialisation a expiré ou n&apos;est plus valide.
          </FormAlert>
          <Link href="/mot-de-passe-oublie" className={buttonVariants()}>
            Demander un nouveau lien
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      description="Vous serez ensuite déconnecté de tous vos appareils."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  )
}
