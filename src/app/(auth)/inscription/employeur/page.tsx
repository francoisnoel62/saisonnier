import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { signUpEmployer } from "@/server/auth/actions"

export const metadata: Metadata = { title: "Inscription employeur" }

export default function EmployerSignUpPage() {
  return (
    <AuthCard
      title="Je recrute"
      description="Créez votre compte pour publier vos annonces. Votre lien avec l'entreprise sera vérifié avant la première publication."
    >
      <SignUpForm action={signUpEmployer} />
    </AuthCard>
  )
}
