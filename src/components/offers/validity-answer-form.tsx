"use client"

import { CircleCheckIcon, EyeOffIcon } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"

import { FormAlert } from "@/components/auth/form-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  answerValidity,
  type ValidityAnswerState,
} from "@/server/offers/validity-actions"

// Les deux réponses au rappel de validité : des boutons d'un formulaire envoyé en POST (§6).
export function ValidityAnswerForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    ValidityAnswerState,
    FormData
  >(answerValidity.bind(null, token), {})

  if (state.done) {
    const confirmed = state.done === "confirmed"
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          {confirmed ? (
            <CircleCheckIcon aria-hidden />
          ) : (
            <EyeOffIcon aria-hidden />
          )}
          <AlertTitle>
            {confirmed
              ? "Merci : votre annonce reste en ligne."
              : "Votre annonce est retirée."}
          </AlertTitle>
          <AlertDescription>
            {confirmed
              ? "Nous vous reposerons la question dans 30 jours."
              : "Les candidats ne la voient plus. Vous pouvez la remettre en ligne depuis votre espace."}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/employeur/annonces">Voir mes annonces</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message && <FormAlert>{state.message}</FormAlert>}
      <Button
        type="submit"
        name="answer"
        value="confirm"
        disabled={pending}
        aria-busy={pending}
      >
        Oui, toujours valable
      </Button>
      <Button
        type="submit"
        name="answer"
        value="withdraw"
        variant="outline"
        disabled={pending}
      >
        Non, retirer l&rsquo;annonce
      </Button>
    </form>
  )
}
