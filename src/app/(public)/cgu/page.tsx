import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, LegalSection } from "@/components/public/legal-page"
import { site } from "@/config/site"

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
}

export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation">
      <LegalSection title="Objet">
        <p>
          {site.name} met en relation des candidats et des employeurs pour des
          emplois saisonniers. Ces conditions encadrent l&apos;usage du service.
        </p>
      </LegalSection>

      <LegalSection title="Accès et gratuité">
        <ul>
          <li>
            La création d&apos;un compte et l&apos;accès aux offres sont
            gratuits pour les candidats.
          </li>
          <li>Le dépôt d&apos;une annonce est gratuit pour les employeurs.</li>
          <li>Un compte est nécessaire pour consulter les offres.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Annonces et vérification des déposants">
        <ul>
          <li>
            Le déposant est tenu de fournir des informations exactes sur
            l&apos;offre et sur son lien avec l&apos;entreprise.
          </li>
          <li>
            Ce lien est vérifié avant la publication des annonces. Tant
            qu&apos;il ne l&apos;est pas, les annonces restent invisibles.
          </li>
          <li>
            Une information non renseignée est affichée « Non précisé » : elle
            ne vaut ni acceptation ni refus.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Annonces collectées">
        <p>
          Certaines annonces sont recueillies par {site.name} auprès de sources
          publiques. Elles ne peuvent être modifiées que par le fondateur : pour
          demander une correction ou un retrait,{" "}
          <Link
            href="/contact?motif=annonce-collectee"
            className="underline underline-offset-4 hover:text-foreground"
          >
            contactez-le
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Candidatures">
        <ul>
          <li>
            Le candidat envoie lui-même son dossier à l&apos;employeur.{" "}
            {site.name} ne transmet aucun document automatiquement.
          </li>
          <li>
            Le CV déposé reste privé : il n&apos;est pas accessible aux
            employeurs depuis le service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Prestations">
        <p>
          Des prestations complémentaires peuvent être proposées aux employeurs
          sur demande. Elles ne garantissent en aucun cas une embauche.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          {site.name} n&apos;est pas partie au contrat de travail conclu entre
          un candidat et un employeur et ne garantit ni l&apos;exactitude des
          annonces ni la conclusion d&apos;un contrat.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement des données est décrit dans la{" "}
          <Link
            href="/confidentialite"
            className="underline underline-offset-4 hover:text-foreground"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
