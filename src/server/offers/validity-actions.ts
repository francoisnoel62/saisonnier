"use server"

import { revalidatePath } from "next/cache"

import { confirmValidity, offerFromToken, withdrawOffer } from "./validity"

export type ValidityAnswerState = {
  done?: "confirmed" | "withdrawn"
  message?: string
}

const tokenMessages = {
  invalid: "Ce lien n'est pas valide. Connectez-vous pour gérer vos annonces.",
  expired: "Ce lien a expiré. Connectez-vous pour gérer vos annonces.",
} as const

// Réponse au rappel de validité, en POST depuis la page du lien signé : un simple GET n'agit
// jamais. Le jeton signé tient lieu de session (plan 16) ; il est revérifié à chaque envoi.
export async function answerValidity(
  token: string,
  _state: ValidityAnswerState,
  formData: FormData,
): Promise<ValidityAnswerState> {
  const found = await offerFromToken(String(token))
  if (!found.ok) return { message: tokenMessages[found.reason] }

  const answer = formData.get("answer")
  if (answer !== "confirm" && answer !== "withdraw") {
    return { message: "Choisissez une réponse." }
  }
  const done =
    answer === "confirm"
      ? await confirmValidity(found.offer.id)
      : await withdrawOffer(found.offer.id)
  if (!done) {
    return {
      message:
        "Cette annonce n'est plus en ligne. Connectez-vous pour la gérer depuis votre espace.",
    }
  }

  revalidatePath("/employeur", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  return { done: answer === "confirm" ? "confirmed" : "withdrawn" }
}
