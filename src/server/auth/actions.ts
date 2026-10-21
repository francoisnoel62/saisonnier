"use server"

import { isAPIError } from "better-auth/api"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password"
import { auth } from "@/lib/auth"
import { authErrorMessage } from "@/lib/auth-errors"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"

// L'inscription passe par une Server Action pour que le rôle soit posé côté serveur.
// Aucune page n'affiche de données mises en cache par ces actions : pas de revalidatePath.

export type SignUpState = {
  message?: string
  fieldErrors?: Partial<
    Record<"name" | "email" | "password" | "terms", string[]>
  >
  // Réaffichées après une erreur ; le mot de passe n'est jamais renvoyé.
  values?: { name: string; email: string }
}

const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Indiquez votre nom.")
    .max(100, "Le nom ne doit pas dépasser 100 caractères."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Saisissez une adresse email valide.")),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
    )
    .max(
      PASSWORD_MAX_LENGTH,
      `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
    ),
  terms: z.literal(
    "on",
    "Acceptez les conditions générales d'utilisation pour créer votre compte.",
  ),
})

async function signUp(
  role: "candidate" | "employer",
  formData: FormData,
): Promise<SignUpState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  }
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { name, email, password } = parsed.data
  try {
    // Le corps ne contient pas de rôle : Better Auth pose "candidate" (input: false).
    const { user: created } = await auth.api.signUpEmail({
      body: { name, email, password, callbackURL: "/apres-connexion" },
      headers: await headers(),
    })
    // Pour un email déjà inscrit, Better Auth renvoie un compte fictif (protection contre
    // l'énumération) : la mise à jour ne touche alors aucune ligne et le compte existant garde
    // son rôle.
    if (role === "employer") {
      await db
        .update(user)
        .set({ role: "employer" })
        .where(eq(user.id, created.id))
    }
  } catch (error) {
    if (!isAPIError(error)) console.error(error)
    return {
      message: isAPIError(error)
        ? authErrorMessage({
            code: error.body?.code,
            status: error.statusCode,
          })
        : authErrorMessage({}),
      values,
    }
  }

  redirect(`/verification-email?${new URLSearchParams({ email })}`)
}

export async function signUpCandidate(_: SignUpState, formData: FormData) {
  return signUp("candidate", formData)
}

export async function signUpEmployer(_: SignUpState, formData: FormData) {
  return signUp("employer", formData)
}
