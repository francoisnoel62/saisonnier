"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { SubmitButton } from "@/components/auth/submit-button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { authErrorMessage } from "@/lib/auth-errors"

type SignInState = {
  message?: string
  unverified?: boolean
  email?: string
}

// La connexion passe par l'API Better Auth (/api/auth), qui limite le nombre de tentatives.
export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (_: SignInState, formData: FormData): Promise<SignInState> => {
      const email = String(formData.get("email") ?? "").trim()
      const password = String(formData.get("password") ?? "")

      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        return {
          message: authErrorMessage(error),
          unverified: error.code === "EMAIL_NOT_VERIFIED",
          email,
        }
      }

      // /apres-connexion choisit l'accueil du rôle ; la page demandée reste prioritaire.
      router.replace(next ?? "/apres-connexion")
      return { email }
    },
    {},
  )

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && (
          <FormAlert>
            {state.message}
            {state.unverified && state.email && (
              <>
                {" "}
                <Link
                  href={`/verification-email?${new URLSearchParams({ email: state.email })}`}
                  className="font-medium underline underline-offset-4"
                >
                  Recevoir un nouveau lien
                </Link>
              </>
            )}
          </FormAlert>
        )}

        <Field>
          <FieldLabel htmlFor="email">Adresse email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Link
              href="/mot-de-passe-oublie"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Field>
          <SubmitButton pending={pending}>Se connecter</SubmitButton>
          <FieldDescription className="text-center">
            Pas encore de compte ?{" "}
            <Link href="/inscription">Créer un compte</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
