import { expect, it } from "vitest"

import { authorizationRequestText } from "@/domain/scan/authorization-request"
import {
  detectSource,
  detectWithoutReading,
  domainToExclude,
  shouldSkipRead,
} from "@/domain/scan/detection"
import { franceTravailSearchUrl } from "@/domain/scan/france-travail"
import { knownPlatformFor } from "@/domain/scan/known-platforms"

import { detectionSignals } from "../inspect"
import { fixtureFile } from "./adapter-test-fixtures"

const context = {
  blockedDomains: [
    "indeed.fr",
    "indeed.com",
    "francetravail.fr",
    "seasonjobs.com",
  ],
}
function detect(
  source: string,
  file: string,
  finalUrl: string,
  contentType = "text/html",
) {
  return detectSource(
    detectionSignals({
      body: fixtureFile(source, file),
      finalUrl,
      contentType,
    }),
    context,
  )
}

it("Teamtailor : flux à l'espace de noms tt: et fiches /jobs/<id>-<intitulé> (Belambra, MS Vacances)", () => {
  for (const [source, host] of [
    ["belambra", "recrute.belambra.fr"],
    ["ms-vacances", "emploi.ms-vacances.com"],
  ]) {
    const report = detect(
      source,
      "list.xml",
      `https://${host}/jobs.rss`,
      "application/rss+xml",
    )
    expect(report.proposals[0]).toMatchObject({
      adapter: "teamtailor",
      kind: "employer",
      params: { portalUrl: `https://${host}` },
    })
    expect(report.proposals[0].evidence.join(" ")).toContain("tt:")
    expect(report.javascriptShell).toBe(false)
  }
})

it("Factorial : liens /job_posting/<intitulé>-<id> et hôte *.factorial.fr (VVF)", () => {
  const report = detect("vvf", "list.html", "https://vvfrecrute.factorial.fr/")
  expect(report.proposals).toEqual([
    expect.objectContaining({
      adapter: "factorial",
      params: { portalUrl: "https://vvfrecrute.factorial.fr" },
    }),
  ])
  expect(report.knownPlatform?.id).toBe("factorial")
})

it("France Travail : recherche publique proposée en découverte, domaine exclu signalé", () => {
  const report = detect("france-travail", "list.html", franceTravailSearchUrl)
  expect(report.proposals).toEqual([
    expect.objectContaining({
      adapter: "france-travail",
      kind: "discovery",
      params: { searchUrls: [franceTravailSearchUrl] },
    }),
  ])
  expect(report.blockedDomain).toBe(true)
  expect(report.knownPlatform?.id).toBe("france-travail")
})

it("une coquille JavaScript n'a aucun connecteur (V4)", () => {
  const report = detectSource(
    detectionSignals({
      body: '<html><head><script src="/app.js"></script></head><body><div id="root"></div><noscript>Activez JavaScript</noscript></body></html>',
      finalUrl: "https://recrutement.exemple.fr/",
      contentType: "text/html",
    }),
    context,
  )
  expect(report.proposals).toEqual([])
  expect(report.javascriptShell).toBe(true)
  expect(report.notes.join(" ")).toContain("JavaScript")
})

it("aucune proposition sans signal : « non détecté »", () => {
  const report = detectSource(
    detectionSignals({
      body: "<html><body><p>Bienvenue sur notre site, nos offres arrivent bientôt.</p><a href='/contact'>Contact</a></body></html>",
      finalUrl: "https://www.hotel.exemple.fr/",
      contentType: "text/html",
    }),
    context,
  )
  expect(report.proposals).toEqual([])
  expect(report.javascriptShell).toBe(false)
  expect(report.notes).toContain(
    "Non détecté : aucun signal d'un format connu.",
  )
})

it("un job-board exclu n'est proposé qu'en découverte ; Indeed n'est jamais lu", () => {
  const report = detectSource(
    detectionSignals({
      body: "<html><body><a href='/offre/1'>Serveur</a></body></html>",
      finalUrl: "https://www.seasonjobs.com/",
      contentType: "text/html",
    }),
    context,
  )
  expect(report.proposals).toEqual([
    expect.objectContaining({ adapter: null, kind: "discovery" }),
  ])
  expect(shouldSkipRead("https://fr.indeed.com/emplois?q=serveur")).toBe(true)
  expect(shouldSkipRead("https://www.linkedin.com/jobs")).toBe(true)
  expect(shouldSkipRead("https://recrute.belambra.fr")).toBe(false)
  expect(
    detectWithoutReading("https://fr.indeed.com/emplois", context),
  ).toMatchObject({
    knownPlatform: { id: "indeed" },
    blockedDomain: true,
    proposals: [expect.objectContaining({ kind: "discovery" })],
  })
})

it("plateforme connue par hôte et sous-domaine, jamais par ressemblance", () => {
  expect(knownPlatformFor("fr.indeed.com")?.id).toBe("indeed")
  expect(knownPlatformFor("jobs.smartrecruiters.com")?.id).toBe(
    "smartrecruiters",
  )
  expect(knownPlatformFor("recrutement.sandaya.jobs")?.id).toBe("werecruit")
  expect(knownPlatformFor("notindeed.com")).toBeNull()
  expect(knownPlatformFor("www.belambra.fr")).toBeNull()
})

it("domaine à exclure d'un hôte de découverte", () => {
  expect(domainToExclude("www.jobanim.com")).toBe("jobanim.com")
  expect(domainToExclude("emplois.jobanim.com")).toBe("jobanim.com")
})

it("demande d'autorisation : service, objet, robot, politesse, données, contact", () => {
  expect(
    authorizationRequestText(
      {
        label: "Belambra",
        employerName: "Belambra Clubs",
        portalUrl: "https://recrute.belambra.fr",
      },
      { name: "Saisonnier", url: "https://saisonnier.example" },
    ),
  ).toMatchInlineSnapshot(`
    "Objet : Saisonnier — demande d'autorisation de reprise de vos offres saisonnières

    Bonjour,

    Saisonnier est un service de recherche d'emplois saisonniers en France (https://saisonnier.example). Nous souhaitons référencer les offres d'emploi saisonnier publiées par Belambra Clubs sur votre portail carrière (https://recrute.belambra.fr), et vous demandons votre autorisation écrite.

    Ce que nous lirions :
    - un passage par jour, vers 3 h, une requête à la fois, 2 s au moins entre deux requêtes, robots.txt respecté ;
    - notre robot s'identifie ainsi : SaisonnierBot/1.0 (+https://saisonnier.example/contact).

    Ce que nous publierions :
    - les informations structurées de chaque offre (poste, lieu, période, contrat, rémunération si elle est indiquée) et un résumé fidèle ;
    - un lien vers l'offre officielle sur votre portail ; les candidatures se font toujours chez vous.

    Aucune donnée personnelle (candidats, recruteurs) n'est collectée.

    Pouvez-vous nous confirmer votre accord, ou nous indiquer vos conditions ? Nous retirerons vos offres sur simple demande.

    Contact : https://saisonnier.example/contact"
  `)
})

it("page carrière : motif proposé avec le nombre de liens reconnus et des exemples", () => {
  const links = [101, 102, 103]
    .map((id) => `<a href="/carriere/offres/poste-${id}">Poste ${id}</a>`)
    .join("")
  const report = detectSource(
    detectionSignals({
      body: `<html><body><a href="/contact">Contact</a>${links}<a rel="next" href="/carriere?page=2">Suivant</a></body></html>`,
      finalUrl: "https://recrute.hotel-test.example/carriere",
      contentType: "text/html",
    }),
    context,
  )
  expect(report.proposals).toEqual([
    expect.objectContaining({
      adapter: "career-page",
      params: expect.objectContaining({
        postingPattern:
          "https://recrute.hotel-test.example/carriere/offres/{slug}-{id}",
        pagination: { kind: "next" },
      }),
      evidence: expect.arrayContaining([
        expect.stringContaining("3 liens reconnus"),
      ]),
    }),
  ])
})
