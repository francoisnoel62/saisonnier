import { LockIcon } from "lucide-react"
import type { Metadata } from "next"

import { ApplicationMessageForm } from "@/components/dossier/application-message-form"
import { ContactDetailsForm } from "@/components/dossier/contact-details-form"
import { DocumentField } from "@/components/dossier/document-field"
import { DossierStatus } from "@/components/dossier/dossier-banner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { dossierStatus } from "@/domain/candidate-dossier"
import { requireRole } from "@/lib/dal"
import { getDossier } from "@/server/candidates/dossier"
import {
  updateApplicationMessage,
  updateContactDetails,
} from "@/server/candidates/dossier-actions"

export const metadata: Metadata = { title: "Mon dossier" }

// Dossier du candidat (§5) : exigé pour candidater, jamais pour rechercher. Les documents sont
// privés : ni les employeurs ni l'admin n'y ont accès (H11).
export default async function DossierPage() {
  const { user } = await requireRole("candidate")
  const dossier = await getDossier(user.id)
  const { missing } = dossierStatus({
    name: dossier.name,
    phone: dossier.phone,
    cvPathname: dossier.cv?.pathname,
  })

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <DossierStatus missing={missing} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Coordonnées</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactDetailsForm
            action={updateContactDetails}
            defaults={{
              name: dossier.name,
              email: dossier.email,
              phone: dossier.phone ?? "",
              city: dossier.city ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>CV</h2>
          </CardTitle>
          <CardDescription>
            Un PDF de 4 Mo au plus, obligatoire avant votre première
            candidature.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            Votre CV reste privé : aucun employeur ne peut le consulter et nous
            ne l&rsquo;envoyons jamais à votre place.
          </p>
          <DocumentField kind="cv" document={dossier.cv} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Lettre de motivation</h2>
          </CardTitle>
          <CardDescription>
            Facultative. Un PDF de 4 Mo au plus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentField kind="cover_letter" document={dossier.coverLetter} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Message d&rsquo;accompagnement</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationMessageForm
            action={updateApplicationMessage}
            defaultMessage={dossier.applicationMessage ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
