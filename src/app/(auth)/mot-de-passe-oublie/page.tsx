import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = { title: "Mot de passe oublié" }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Saisissez l'adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
