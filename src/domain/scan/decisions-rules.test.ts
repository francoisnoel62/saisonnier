import { describe, expect, it } from "vitest"

import { admitPosting } from "./admission"
import { absent, established, valueOf } from "./field"
import {
  canonicalUrl,
  compareRecruitment,
  recruitmentIdentity,
} from "./identity"
import { buildProposal, proposalIssues } from "./proposal"
import { canAutoPublish, publicationReadiness } from "./readiness"
import {
  admissionContext,
  evidence,
  observation,
  posting,
  readinessContext,
} from "./rules-fixtures"
import { normalizeJobTitle } from "./title"
import {
  isAdmissionRejection,
  rejectionReasons,
  scanIssueCodes,
  scanIssueDefinitions,
} from "./vocabulary"

const proposal = () => buildProposal(posting(), { referenceDate: "2026-10-24" })
describe("§10 — admission d'un dossier exploitable pour la revue", () => {
  it("une durée et un début explicites déjà entièrement révolus ferment le recrutement", () => {
    const input = posting({
      usefulText: posting().usefulText.replace(
        "du 15 décembre 2026 au 15 avril 2027",
        "pour 4 mois à partir du 15 décembre 2025",
      ),
    })
    expect(admitPosting(input, admissionContext)).toMatchObject({
      admitted: false,
      reason: "closed",
    })
  })
  it("un dossier complet et pertinent est admis avec ses preuves", () => {
    const result = admitPosting(posting(), admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted) {
      expect(result.signals.length).toBeGreaterThan(0)
      expect(result.blocking).toHaveLength(0)
    }
  })
  it("remplissage initial : une offre ancienne non close est admise", () =>
    expect(
      admitPosting(
        posting({
          sourceDate: {
            precision: "day",
            date: "2020-01-01",
            timeZone: "Europe/Paris",
          },
        }),
        { ...admissionContext, mode: "bootstrap", window: null },
      ).admitted,
    ).toBe(true))
  it("annonce sans date : admise, découverte le…", () => {
    const result = admitPosting(posting({ sourceDate: null }), admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted) {
      expect(result.discoveredLabel).toBe("découverte le 2026-10-24")
      expect(result.alerts.map((issue) => issue.code)).toContain(
        "publication_date_unknown",
      )
    }
  })
  it("un dossier pertinent sans période, canal ni source officielle compte pour la revue", () => {
    const input = posting({
      officialUrl: undefined,
      contacts: [],
      usefulText:
        "Nous recherchons pour notre équipe un serveur en CDD saisonnier. Vous accueillez les clients dans notre restaurant et vous préparez la salle pour le service. Vous participez à la vie de notre établissement de tourisme avec toute notre équipe.",
    })
    const result = admitPosting(input, admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted)
      expect(result.blocking.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["period", "application", "official_source"]),
      )
  })
  it("une absence de preuve de clôture ne prouve pas l'activité", () => {
    const input = posting({
      observations: posting().observations.filter(
        (item) => item.field !== "activity",
      ),
    })
    const result = admitPosting(input, admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted)
      expect(result.blocking.map((issue) => issue.code)).toContain("activity")
  })
  it.each([
    ["poste pourvu", "closed"],
    ["offre clôturée", "closed"],
    ["n'est plus disponible", "closed"],
    ["CDI", "out_of_scope"],
  ])("une exclusion garde son motif : %s", (text, reason) => {
    const input = posting({
      title: "Serveur H/F",
      usefulText: `${text}. Nous recherchons un serveur pour notre établissement. Vous accueillez les clients et préparez la salle pour le service. Notre équipe assure les repas pour les vacanciers dans une ambiance agréable et vous participez au bon fonctionnement du restaurant.`,
    })
    expect(admitPosting(input, admissionContext)).toMatchObject({
      admitted: false,
      reason,
    })
  })
  it("CDI et saisonnier : admission pour revue, contradiction bloquante", () => {
    const input = posting()
    input.usefulText += " Contrat CDI."
    const result = admitPosting(input, admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted)
      expect(result.blocking.map((issue) => issue.code)).toContain(
        "contract_contradiction",
      )
  })
  it("CDD seul : caractère saisonnier à vérifier", () => {
    const input = posting({
      title: "Serveur",
      usefulText: posting()
        .usefulText.replace("CDD saisonnier", "CDD")
        .replace("du 15 décembre 2026 au 15 avril 2027", ""),
    })
    const result = admitPosting(input, admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted)
      expect(result.blocking.map((issue) => issue.code)).toContain(
        "seasonal_contract",
      )
  })
  it.each([
    { title: "" },
    { usefulText: "Un simple lien", observations: [] },
    { collectedAt: "invalide" },
    { discoveryUrl: "invalide" },
  ])(
    "une simple piste sans contenu ou collecte exploitable ne compte pas : %j",
    (changes) =>
      expect(admitPosting(posting(changes), admissionContext)).toMatchObject({
        admitted: false,
        reason: "no_content",
      }),
  )
  it("trois champs structurés permettent une revue sans 200 caractères", () => {
    const input = posting({
      usefulText: "",
      observations: [
        ...posting().observations,
        observation("CDD saisonnier", "contract"),
      ],
    })
    expect(admitPosting(input, admissionContext).admitted).toBe(true)
  })
  it("une source employeur de tourisme documentée est un indice suffisant", () => {
    const input = posting({
      title: "Serveur",
      usefulText:
        "Nous recherchons un serveur pour notre restaurant. Vous accueillez les clients dans notre établissement et vous préparez la salle pour le service des repas. Vous travaillez avec les membres de notre équipe et vous assurez un accueil de qualité.",
    })
    expect(
      admitPosting(input, {
        ...admissionContext,
        source: { ...admissionContext.source, tourism: true, evidence },
      }).admitted,
    ).toBe(true)
    expect(admitPosting(input, admissionContext)).toMatchObject({
      admitted: false,
      reason: "out_of_scope",
    })
  })
  it("un pays explicite hors France exclut le dossier", () => {
    const input = posting()
    input.observations.push(
      observation(
        [{ communeName: "Berlin", country: "Allemagne" }],
        "locations",
      ),
    )
    input.observations = input.observations.filter(
      (item) =>
        item.field !== "locations" ||
        (item.value as { country: string }[])[0].country === "Allemagne",
    )
    expect(admitPosting(input, admissionContext)).toMatchObject({
      admitted: false,
      reason: "outside_france",
    })
  })
  it("un texte anglais est exclu", () =>
    expect(
      admitPosting(
        posting({
          usefulText:
            "We are looking for a seasonal waiter for our restaurant. You will work with our team and welcome the guests in our pleasant dining room. We offer accommodation and meals for the season. Please send your application to our recruitment team.",
        }),
        admissionContext,
      ),
    ).toMatchObject({ admitted: false, reason: "not_french" }))
  it("une date source antérieure à la fenêtre quotidienne est exclue", () =>
    expect(
      admitPosting(
        posting({
          sourceDate: { precision: "instant", at: "2026-10-21T09:59:59Z" },
        }),
        admissionContext,
      ),
    ).toMatchObject({ admitted: false, reason: "outside_window" }))
  it("un domaine .example hors mode test ne compte pas", () =>
    expect(
      admitPosting(posting(), { ...admissionContext, testMode: false }),
    ).toMatchObject({ admitted: false, reason: "test_data" }))
  it("une source de test hors mode test ne compte pas", () =>
    expect(
      admitPosting(posting(), {
        ...admissionContext,
        testMode: false,
        source: { ...admissionContext.source, test: true },
      }),
    ).toMatchObject({ admitted: false, reason: "test_data" }))
  it("découverte le… désigne le jour de Paris même après minuit local", () => {
    const result = admitPosting(
      posting({ collectedAt: "2026-10-24T23:30:00Z", sourceDate: null }),
      admissionContext,
    )
    expect(result.admitted && result.discoveredLabel).toBe(
      "découverte le 2026-10-25",
    )
  })
  it("une échéance passée exclut le dossier, la date de début seule ne le ferme pas", () => {
    const input = posting()
    input.observations.push(observation("2026-10-23", "validThrough"))
    expect(admitPosting(input, admissionContext)).toMatchObject({
      admitted: false,
      reason: "closed",
    })
    expect(
      admitPosting(
        posting({
          usefulText: posting().usefulText.replace(
            "15 décembre 2026",
            "15 septembre 2026",
          ),
        }),
        admissionContext,
      ).admitted,
    ).toBe(true)
  })
  it("l'échéance d'aujourd'hui reste ouverte jusqu'à la fin du jour", () => {
    const input = posting()
    input.observations.push(observation("2026-10-24", "validThrough"))
    expect(admitPosting(input, admissionContext).admitted).toBe(true)
  })
  it("la fin de contrat passée exclut le dossier", () =>
    expect(
      admitPosting(
        posting({
          usefulText: posting().usefulText.replace(
            "15 décembre 2026 au 15 avril 2027",
            "15 décembre 2025 au 15 avril 2026",
          ),
        }),
        admissionContext,
      ),
    ).toMatchObject({ admitted: false, reason: "closed" }))
})

describe("§10 — minimum de publication et automatisation SH4", () => {
  it("passage quotidien, source autorisée, dossier complet : publication automatique possible", () => {
    const readiness = publicationReadiness(proposal(), readinessContext)
    expect(readiness.blocking).toHaveLength(0)
    expect(
      canAutoPublish({ mode: "daily", sourceAutoPublish: true, readiness }),
    ).toBe(true)
    expect(
      canAutoPublish({ mode: "daily", sourceAutoPublish: false, readiness }),
    ).toBe(false)
  })
  it("mode initial : jamais de publication automatique, même pour un dossier complet", () => {
    expect(
      canAutoPublish({
        mode: "bootstrap",
        sourceAutoPublish: true,
        readiness: { blocking: [], alerts: [] },
      }),
    ).toBe(false)
    for (const code of scanIssueCodes)
      expect(
        canAutoPublish({
          mode: "bootstrap",
          sourceAutoPublish: true,
          readiness: {
            blocking: [],
            alerts: [{ code, ...scanIssueDefinitions[code] }],
          },
        }),
      ).toBe(false)
  })
  it.each([
    ["company", "company"],
    ["contract", "seasonal_contract"],
    ["period", "period"],
    ["locations", "location"],
    ["application", "application"],
    ["officialUrl", "official_source"],
    ["activity", "activity"],
  ] as const)("un minimum absent bloque : %s", (field, code) => {
    const input = proposal()
    input[field] = absent()
    const readiness = publicationReadiness(input, readinessContext)
    expect(readiness.blocking.map((issue) => issue.code)).toContain(code)
    expect(
      canAutoPublish({ mode: "daily", sourceAutoPublish: true, readiness }),
    ).toBe(false)
  })
  it("une URL officielle ne se déduit pas d'un nom de marque ou d'un sous-domaine", () => {
    const input = proposal()
    input.officialUrl = established(
      "https://hotel.example.evil.example/offre",
      [evidence],
    )
    expect(
      publicationReadiness(input, readinessContext).blocking.map(
        (issue) => issue.code,
      ),
    ).toContain("official_source")
    input.officialUrl = established("https://jobs.hotel.example/offre", [
      evidence,
    ])
    expect(
      publicationReadiness(input, readinessContext).blocking.map(
        (issue) => issue.code,
      ),
    ).toContain("official_source")
  })
  it("doublon ouvert et identité réutilisée bloquent la publication", () =>
    expect(
      publicationReadiness(proposal(), {
        ...readinessContext,
        potentialDuplicate: true,
        reusedIdentity: true,
      }).blocking.map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(["duplicate", "reused_identity"])))
  it("année déduite bloque la publication", () => {
    const input = posting({
      usefulText: posting().usefulText.replace(
        "15 décembre 2026 au 15 avril 2027",
        "15 décembre au 15 avril",
      ),
    })
    expect(
      publicationReadiness(
        buildProposal(input, { referenceDate: "2026-10-24" }),
        readinessContext,
      ).blocking.map((issue) => issue.code),
    ).toContain("year_inferred")
  })
  it("postes multiples mal associés et détail illisible bloquent", () => {
    const input = proposal()
    input.multiplePositions = true
    input.detailReadable = false
    expect(
      publicationReadiness(input, readinessContext).blocking.map(
        (issue) => issue.code,
      ),
    ).toEqual(
      expect.arrayContaining(["multiple_positions", "detail_unreadable"]),
    )
  })
  it("salaire et conditions absents ne bloquent pas", () =>
    expect(
      publicationReadiness(proposal(), readinessContext).blocking,
    ).toHaveLength(0))
  it("métier inconnu et salaire contradictoire : alertes sans blocage", () => {
    const input = posting()
    input.observations.push(
      observation("1800 € net mensuel", "salary"),
      observation("2000 € net mensuel", "salary"),
    )
    const result = publicationReadiness(
      buildProposal(input, { referenceDate: "2026-10-24" }),
      { ...readinessContext, occupationKnown: false },
    )
    expect(result.blocking).toHaveLength(0)
    expect(result.alerts.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["occupation_unknown", "optional_contradiction"]),
    )
  })
  it("validThrough reste une échéance distincte de la période", () => {
    const input = posting()
    input.observations.push(observation("2026-11-30", "validThrough"))
    const result = buildProposal(input, { referenceDate: "2026-10-24" })
    expect(valueOf(result.applicationDeadline)).toMatchObject({
      precision: "day",
      date: "2026-11-30",
    })
    expect(valueOf(result.period)?.endDate).toBe("2027-04-15")
  })
  it("l'assemblage ne modifie pas les observations de l'adaptateur", () => {
    const input = posting()
    const snapshot = structuredClone(input)
    buildProposal(input, { referenceDate: "2026-10-24" })
    expect(input).toEqual(snapshot)
  })
  it("un résumé ne masque pas les preuves supplémentaires du texte utile", () => {
    const input = posting()
    input.observations.push(observation("Service en salle", "description"))
    const result = buildProposal(input, { referenceDate: "2026-10-24" })
    expect(result.contract.status).toBe("established")
    expect(result.period.status).toBe("established")
    expect(valueOf(result.description)).toBe("Service en salle")
  })
  it("une date de début seule ne suffit jamais au minimum de période", () => {
    const input = proposal()
    input.period = established({ startDate: "2026-12-15" }, [evidence])
    expect(
      publicationReadiness(input, readinessContext).blocking.map(
        (issue) => issue.code,
      ),
    ).toContain("period")
  })
  it("un champ ne s'établit jamais sans preuve", () =>
    expect(established("invention", [])).toEqual({
      status: "absent",
      evidence: [],
    }))
  it("deux dates de publication contradictoires ne sont pas départagées pour l'exclusion", () => {
    const input = posting({
      sourceDate: {
        precision: "day",
        date: "2020-01-01",
        timeZone: "Europe/Paris",
      },
    })
    input.observations.push(observation("2026-10-23", "datePosted"))
    const result = admitPosting(input, admissionContext)
    expect(result.admitted).toBe(true)
    if (result.admitted)
      expect(result.proposal.sourceDate.status).toBe("contradictory")
  })
  it("une URL d'accueil avec seulement du suivi n'est pas une découverte précise", () => {
    expect(
      admitPosting(
        posting({ discoveryUrl: "https://hotel.example/?utm_source=scan" }),
        admissionContext,
      ),
    ).toMatchObject({ admitted: false, reason: "no_content" })
  })
  it("le motif d'URL de la source permet de distinguer une liste d'une fiche", () => {
    expect(
      admitPosting(posting({ discoveryUrl: "https://hotel.example/offres" }), {
        ...admissionContext,
        source: {
          ...admissionContext.source,
          postingUrlPattern: "/offres/[^/]+$",
        },
      }),
    ).toMatchObject({ admitted: false, reason: "no_content" })
  })
  it("la troncature du contenu est signalée", () => {
    const input = posting({
      usefulText: posting().usefulText + "x".repeat(20_000),
    })
    const result = buildProposal(input, { referenceDate: "2026-10-24" })
    expect(valueOf(result.description)?.length).toBe(20_000)
    expect(proposalIssues(result).map((issue) => issue.code)).toContain(
      "text_truncated",
    )
  })
})

describe("§10 — identité d'un recrutement, aucune fusion implicite", () => {
  it("URL canonique : hôte, fragment, suivi et barre finale", () =>
    expect(
      canonicalUrl(
        "https://HOTEL.example/offre/?utm_source=test&gclid=x&id=12#postuler",
      ),
    ).toBe("https://hotel.example/offre?id=12"))
  it("les paramètres métier et les protocoles restent distincts", () => {
    expect(canonicalUrl("https://hotel.example/offre?b=2&a=1")).toBe(
      "https://hotel.example/offre?a=1&b=2",
    )
    expect(canonicalUrl("https://hotel.example/")).toBe("https://hotel.example")
    expect(canonicalUrl("javascript:alert(1)")).toBeNull()
  })
  it("une route de navigateur (#/…) distingue les pages, une simple ancre non", () => {
    expect(canonicalUrl("https://jobs.example/#/offre/12")).toBe(
      "https://jobs.example#/offre/12",
    )
    expect(canonicalUrl("https://jobs.example/#/offre/12")).not.toBe(
      canonicalUrl("https://jobs.example/#/offre/34"),
    )
    expect(canonicalUrl("https://jobs.example/#!/offre/12")).toBe(
      "https://jobs.example#!/offre/12",
    )
    expect(canonicalUrl("https://jobs.example/offre/12#postuler")).toBe(
      canonicalUrl("https://jobs.example/offre/12"),
    )
  })
  it("identifiant externe prioritaire, index de poste y compris zéro", () => {
    expect(
      recruitmentIdentity({
        adapter: "fixture",
        host: "HOTEL.example",
        externalId: "123",
        url: "https://hotel.example/offre",
        index: 0,
      }),
    ).toBe("fixture:hotel.example:123#0")
    expect(
      recruitmentIdentity({
        adapter: "fixture",
        host: "hotel.example",
        url: "https://hotel.example/offre/?utm_source=x",
        index: 2,
      }),
    ).toBe("https://hotel.example/offre#2")
  })
  it("même identifiant, autre période : autre recrutement", () => {
    const known = {
      title: "Serveur H/F",
      period: established({ startDate: "2025-12-15", endDate: "2026-04-15" }, [
        evidence,
      ]),
    }
    const observed = {
      title: "Serveur F/H",
      period: established({ startDate: "2026-12-15", endDate: "2027-04-15" }, [
        evidence,
      ]),
    }
    expect(compareRecruitment(known, observed)).toBe("other_period")
    expect(compareRecruitment(known, { ...observed, title: "Cuisinier" })).toBe(
      "other_period",
    )
  })
  it("des périodes qui se recoupent restent le même recrutement", () => {
    const a = {
      title: "Serveur H/F",
      period: established({ startDate: "2026-12-15", endDate: "2027-04-15" }, [
        evidence,
      ]),
    }
    expect(
      compareRecruitment(a, {
        title: "Serveur F/H",
        period: established(
          { startDate: "2027-04-15", endDate: "2027-05-01" },
          [evidence],
        ),
      }),
    ).toBe("same")
  })
  it("même identifiant et début avec durée d'une autre saison : autre recrutement", () => {
    const known = {
      title: "Serveur",
      period: established(
        {
          startDate: "2025-12-15",
          duration: { value: 4, unit: "months" as const },
        },
        [evidence],
      ),
    }
    const observed = {
      title: "Serveur",
      period: established(
        {
          startDate: "2026-12-15",
          duration: { value: 4, unit: "months" as const },
        },
        [evidence],
      ),
    }
    expect(compareRecruitment(known, observed)).toBe("other_period")
  })
  it("une période inconnue conserve l'identité sauf changement d'intitulé", () => {
    const a = {
      title: "Serveur H/F - Hiver 26-27",
      period: absent<import("./period").Period>(),
    }
    expect(
      compareRecruitment(a, { title: "Serveur F/H", period: a.period }),
    ).toBe("same")
    expect(
      compareRecruitment(a, { title: "Cuisinier", period: a.period }),
    ).toBe("uncertain")
  })
  it.each([
    ["Serveur H/F - Hiver 26-27", "serveur"],
    ["Serveur H/F en CDD — Hiver 26–27", "serveur"],
    ["Réceptionniste F/H — CDD saisonnier été 2027", "receptionniste"],
    ["Chef de partie (H/F)", "chef de partie"],
  ])("intitulé normalisé : %s", (raw, expected) =>
    expect(normalizeJobTitle(raw)).toBe(expected),
  )
  it("seuls les quatre motifs d'admission corrigent le seuil confirmé SH5", () =>
    expect(rejectionReasons.filter(isAdmissionRejection)).toEqual([
      "out_of_scope",
      "closed",
      "duplicate",
      "no_content",
    ]))
  it("toutes les définitions ont un libellé et un caractère bloquant", () => {
    expect(scanIssueCodes).toHaveLength(24)
    expect(
      scanIssueCodes.every(
        (code) =>
          typeof scanIssueDefinitions[code].blocking === "boolean" &&
          !!scanIssueDefinitions[code].label,
      ),
    ).toBe(true)
  })
})
