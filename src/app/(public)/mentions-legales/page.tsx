import type { Metadata } from "next"
import Link from "next/link"

import {
  LegalPage,
  LegalSection,
  ToComplete,
} from "@/components/public/legal-page"
import { site } from "@/config/site"

export const metadata: Metadata = { title: "Mentions légales" }

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="Éditeur du site">
        <p>
          {site.name} est édité par{" "}
          <ToComplete>nom ou raison sociale</ToComplete>,{" "}
          <ToComplete>
            forme juridique et numéro d&apos;immatriculation
          </ToComplete>
          , dont le siège est situé <ToComplete>adresse postale</ToComplete>.
        </p>
        <p>
          Contact : <ToComplete>adresse email</ToComplete> ou via le{" "}
          <Link
            href="/contact"
            className="underline underline-offset-4 hover:text-foreground"
          >
            formulaire de contact
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>
          <ToComplete>nom du directeur de la publication</ToComplete>
        </p>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>
          Le site est hébergé par Vercel Inc.{" "}
          <ToComplete>
            adresse et coordonnées à vérifier sur vercel.com/legal
          </ToComplete>
          .
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les contenus propres à {site.name} (textes, présentation, logo) sont
          protégés. Les annonces restent la propriété de leurs auteurs.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
