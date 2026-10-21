import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { signUpCandidate } from "@/server/auth/actions"

export const metadata: Metadata = { title: "Inscription candidat" }

export default function CandidateSignUpPage() {
  return (
    <AuthCard
      title="Je cherche un job saisonnier"
      description="Créez votre compte pour rechercher les offres. Le CV ne sera demandé qu'avant votre première candidature."
    >
      <SignUpForm action={signUpCandidate} />
    </AuthCard>
  )
}
