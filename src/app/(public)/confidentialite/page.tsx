import type { Metadata } from "next"
import Link from "next/link"

import {
  LegalPage,
  LegalSection,
  ToComplete,
} from "@/components/public/legal-page"
import { site } from "@/config/site"

export const metadata: Metadata = { title: "Politique de confidentialité" }

const linkClass = "underline underline-offset-4 hover:text-foreground"

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="Responsable du traitement">
        <p>
          <ToComplete>éditeur du service</ToComplete>, joignable via le{" "}
          <Link href="/contact" className={linkClass}>
            formulaire de contact
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Données traitées">
        <ul>
          <li>
            <strong>Compte :</strong> nom, adresse email, mot de passe (stocké
            chiffré) et rôle (candidat ou employeur).
          </li>
          <li>
            <strong>Dossier candidat :</strong> nom, téléphone et CV. Le CV
            reste privé : seul son propriétaire peut le consulter, et{" "}
            {site.name} ne l&apos;envoie à personne automatiquement.
          </li>
          <li>
            <strong>Employeur :</strong> entreprise rattachée et annonces
            déposées.
          </li>
          <li>
            <strong>Messages de contact :</strong> les informations saisies dans
            le formulaire.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <ul>
          <li>
            Gérer votre compte et fournir le service : exécution du contrat.
          </li>
          <li>
            Permettre la candidature auprès d&apos;un employeur : exécution du
            contrat, à votre initiative.
          </li>
          <li>
            Vérifier les déposants et prévenir les abus : intérêt légitime.
          </li>
          <li>Répondre à vos messages : intérêt légitime.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <p>
          <ToComplete>
            durées à fixer pour les comptes, les CV, les annonces et les
            messages
          </ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Sous-traitants">
        <ul>
          <li>Vercel : hébergement de l&apos;application.</li>
          <li>Neon : base de données.</li>
          <li>Resend : envoi des emails du service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez accéder à vos données, les rectifier, les effacer, vous
          opposer à leur traitement, en demander la limitation ou la
          portabilité. Pour exercer ces droits, écrivez-nous via le{" "}
          <Link href="/contact" className={linkClass}>
            formulaire de contact
          </Link>
          . Vous pouvez aussi saisir la CNIL (cnil.fr).
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          {site.name} n&apos;utilise que des cookies strictement nécessaires
          (maintien de votre session de connexion). Aucun traceur publicitaire
          ou de mesure d&apos;audience n&apos;est déposé : un bandeau de
          consentement n&apos;est donc pas nécessaire.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
