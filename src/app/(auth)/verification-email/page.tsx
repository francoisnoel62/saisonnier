import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { FormAlert } from "@/components/auth/form-alert"
import { ResendVerificationForm } from "@/components/auth/resend-verification-form"
import { FieldDescription } from "@/components/ui/field"

export const metadata: Metadata = { title: "Vérifiez votre adresse email" }

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verification-email">) {
  const { email, lien } = await searchParams
  const address = typeof email === "string" ? email : undefined

  return (
    <AuthCard
      title="Vérifiez votre adresse email"
      description={
        address ? (
          <>
            Nous avons envoyé un lien de confirmation à{" "}
            <strong className="wrap-anywhere text-foreground">{address}</strong>
            .
          </>
        ) : (
          "Votre compte s'active quand vous ouvrez le lien de confirmation reçu par email."
        )
      }
    >
      <div className="flex flex-col gap-6">
        {lien === "invalide" ? (
          <FormAlert>
            Ce lien de confirmation a expiré ou n&apos;est plus valide.
            Demandez-en un nouveau ci-dessous.
          </FormAlert>
        ) : (
          <p className="text-muted-foreground">
            Ouvrez ce lien pour activer votre compte : il est valable une heure.
            Rien reçu ? Vérifiez vos courriers indésirables, ou demandez un
            nouveau lien.
          </p>
        )}
        <ResendVerificationForm defaultEmail={address} />
        <FieldDescription className="text-center">
          <Link href="/connexion">Retour à la connexion</Link>
        </FieldDescription>
      </div>
    </AuthCard>
  )
}
