import type { MetadataRoute } from "next"

import { site } from "@/config/site"

// Les pages publiques sont indexables ; l'application et l'authentification ne le sont pas (H12).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/offres",
        "/mes-offres",
        "/dossier",
        "/compte",
        "/employeur",
        "/admin",
        "/api/",
        "/connexion",
        "/inscription",
        "/apres-connexion",
        "/mot-de-passe-oublie",
        "/reinitialiser-mot-de-passe",
        "/verification-email",
        "/annonce/",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
