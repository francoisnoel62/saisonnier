import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { ValidityAnswerForm } from "@/components/offers/validity-answer-form"
import { Button } from "@/components/ui/button"
import { publicCompanyName } from "@/domain/application"
import { signInPath } from "@/domain/redirects"
import { formatDate } from "@/lib/format"
import { offerFromToken } from "@/server/offers/validity"

export const metadata: Metadata = {
  title: "Votre annonce est-elle toujours valable ?",
  robots: { index: false, follow: false },
}

const EMPLOYER_OFFERS = "/employeur/annonces"

// Lien signé du rappel de validité (§6, plan 16). Afficher la page n'agit pas : seuls les deux
// boutons, envoyés en POST, confirment ou retirent l'annonce.
export default async function ConfirmValidityPage({
  params,
}: PageProps<"/annonce/confirmer/[token]">) {
  const found = await offerFromToken((await params).token)

  if (!found.ok) {
    return (
      <AuthCard
        title={
          found.reason === "expired" ? "Ce lien a expiré" : "Lien invalide"
        }
        description={
          found.reason === "expired"
            ? "Les liens du rappel de validité sont valables 30 jours."
            : "Ce lien n'est pas valide : il a peut-être été copié incomplètement."
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Connectez-vous pour confirmer ou retirer vos annonces depuis votre
            espace.
          </p>
          <Button asChild>
            <Link href={signInPath(EMPLOYER_OFFERS)}>Se connecter</Link>
          </Button>
        </div>
      </AuthCard>
    )
  }

  const { offer } = found
  const online = offer.status === "published"
  return (
    <AuthCard
      title="Votre annonce est-elle toujours valable ?"
      description="Confirmez-la pour qu'elle reste en ligne, ou retirez-la si le poste est pourvu."
    >
      <div className="flex flex-col gap-6">
        <dl className="grid gap-1 rounded-lg border p-4 text-sm">
          <dt className="sr-only">Annonce</dt>
          <dd className="text-base font-medium break-words">{offer.title}</dd>
          <dt className="sr-only">Entreprise et lieu</dt>
          <dd className="text-muted-foreground">
            {publicCompanyName({ hideCompanyIdentity: false, ...offer })} ·{" "}
            {offer.communeName} ({offer.departmentCode})
          </dd>
          {offer.publishedAt && (
            <>
              <dt className="sr-only">Publication</dt>
              <dd className="text-muted-foreground">
                Publiée le {formatDate(offer.publishedAt)}
                {offer.validityConfirmedAt &&
                  ` · validité confirmée le ${formatDate(offer.validityConfirmedAt)}`}
              </dd>
            </>
          )}
        </dl>
        {online ? (
          <ValidityAnswerForm token={(await params).token} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              Cette annonce n&rsquo;est plus en ligne : il n&rsquo;y a rien à
              confirmer.
            </p>
            <Button asChild variant="outline">
              <Link href={signInPath(EMPLOYER_OFFERS)}>Gérer mes annonces</Link>
            </Button>
          </div>
        )}
      </div>
    </AuthCard>
  )
}
