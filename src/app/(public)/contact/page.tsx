import type { Metadata } from "next"

import { ContactForm } from "@/components/contact/contact-form"
import { topicFromSlug } from "@/domain/contact"
import { getSession } from "@/lib/dal"
import { sendContactMessage } from "@/server/contact/actions"

export const metadata: Metadata = {
  title: "Contacter le fondateur",
  description:
    "Une question, une annonce à corriger, une demande de prestation : écrivez directement au fondateur.",
}

// ?motif=annonce-collectee&offre=<id> présélectionne le sujet et rattache l'annonce.
export default async function ContactPage({
  searchParams,
}: PageProps<"/contact">) {
  const [{ motif, offre }, session] = await Promise.all([
    searchParams,
    getSession(),
  ])
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Contacter le fondateur
        </h1>
        <p className="text-muted-foreground">
          Écrivez-nous : le fondateur lit chaque message et vous répond par
          email.
        </p>
      </div>
      <ContactForm
        action={sendContactMessage}
        defaults={{
          topic: topicFromSlug(first(motif)),
          name: session?.user.name ?? "",
          email: session?.user.email ?? "",
          offerId: first(offre),
        }}
      />
    </div>
  )
}
