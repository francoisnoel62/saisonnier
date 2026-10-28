import { scanLimits } from "./limits"

// Demande d'autorisation de reprise (§11.5), préparée pour le fondateur qui l'envoie de sa boîte
// puis consigne la réponse. Aucun envoi automatique.
export type AuthorizationRequestSource = {
  label: string
  employerName: string | null
  portalUrl: string | null
}
export type AuthorizationRequestSite = {
  name: string
  // Adresse publique du service (BETTER_AUTH_URL en production).
  url: string
}

export function scanUserAgent(site: AuthorizationRequestSite) {
  return `${site.name}Bot/1.0 (+${site.url.replace(/\/$/, "")}/contact)`
}

export function authorizationRequestText(
  source: AuthorizationRequestSource,
  site: AuthorizationRequestSite,
) {
  const owner = source.employerName ?? source.label
  const portal = source.portalUrl ? ` (${source.portalUrl})` : ""
  const contact = `${site.url.replace(/\/$/, "")}/contact`
  return [
    `Objet : ${site.name} — demande d'autorisation de reprise de vos offres saisonnières`,
    "",
    "Bonjour,",
    "",
    `${site.name} est un service de recherche d'emplois saisonniers en France (${site.url}). Nous souhaitons référencer les offres d'emploi saisonnier publiées par ${owner} sur votre portail carrière${portal}, et vous demandons votre autorisation écrite.`,
    "",
    "Ce que nous lirions :",
    `- un passage par jour, vers 3 h, une requête à la fois, ${scanLimits.minIntervalMs / 1000} s au moins entre deux requêtes, robots.txt respecté ;`,
    `- notre robot s'identifie ainsi : ${scanUserAgent(site)}.`,
    "",
    "Ce que nous publierions :",
    "- les informations structurées de chaque offre (poste, lieu, période, contrat, rémunération si elle est indiquée) et un résumé fidèle ;",
    "- un lien vers l'offre officielle sur votre portail ; les candidatures se font toujours chez vous.",
    "",
    "Aucune donnée personnelle (candidats, recruteurs) n'est collectée.",
    "",
    "Pouvez-vous nous confirmer votre accord, ou nous indiquer vos conditions ? Nous retirerons vos offres sur simple demande.",
    "",
    `Contact : ${contact}`,
  ].join("\n")
}
