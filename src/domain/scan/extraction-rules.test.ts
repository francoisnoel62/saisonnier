import { describe, expect, it } from "vitest"

import { applicationChannelState, extractApplication } from "./application"
import { extractConditions } from "./conditions"
import { seasonalContractEvidence } from "./contract"
import { valueOf } from "./field"
import { departmentFromPostalCode, isFrance, isFrenchText } from "./locale"
import { evidence, observation, posting } from "./rules-fixtures"
import { extractSalaryText } from "./salary-text"

describe("§10 — contrat saisonnier prouvé, ambigu ou incompatible", () => {
  it.each([
    "CDD saisonnier",
    "contrat saisonnier",
    "CDD saison",
    "emploi saisonnier",
    "poste saisonnier",
  ])("mention attachée au poste : %s", (text) =>
    expect(seasonalContractEvidence([observation(text)]).status).toBe(
      "explicit",
    ),
  )
  it("saisonnier H/F dans l'intitulé : explicite", () =>
    expect(
      seasonalContractEvidence([
        observation("Serveur saisonnier (H/F)", "title"),
      ]).status,
    ).toBe("explicit"))
  it.each([
    "CDD",
    "saison d'hiver",
    "du 1er juin au 30 août",
    "nous recrutons pour l'été",
  ])("caractère saisonnier à vérifier : %s", (text) =>
    expect(seasonalContractEvidence([observation(text)]).status).toBe(
      "ambiguous",
    ),
  )
  it.each(["CDI", "poste à l'année", "contrat en alternance", "stage"])(
    "contrat explicitement hors périmètre : %s",
    (text) =>
      expect(seasonalContractEvidence([observation(text)]).status).toBe(
        "not_seasonal",
      ),
  )
  it.each([
    "ce n'est pas un contrat saisonnier",
    "pas de CDD saisonnier",
    "contrat saisonnier non proposé",
    "pas de CDI",
  ])("une négation n'établit rien : %s", (text) =>
    expect(seasonalContractEvidence([observation(text)]).status).toBe(
      "ambiguous",
    ),
  )
  it("le texte général du site n'établit aucun contrat", () =>
    expect(
      seasonalContractEvidence([
        observation("CDD saisonnier", "description", "site"),
      ]).evidence,
    ).toHaveLength(0))
  it("CDI et saisonnier : contradiction bloquante, aucune priorité arbitraire", () => {
    const result = seasonalContractEvidence([
      observation("CDI et contrat saisonnier"),
    ])
    expect(result.contradictory).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "contract_contradiction",
        blocking: true,
      }),
    )
  })
  it.each(["CDI saisonnier", "CDI et saisonnier"])(
    "la mention saisonnière reste contradictoire même sans CDD : %s",
    (text) => {
      expect(seasonalContractEvidence([observation(text)]).contradictory).toBe(
        true,
      )
    },
  )
  it("la négation ne fuit pas au-delà de mais", () =>
    expect(
      seasonalContractEvidence([
        observation("Pas de CDI mais un CDD saisonnier"),
      ]).status,
    ).toBe("explicit"))
  it("la négation ne fuit pas au-delà d'une virgule", () =>
    expect(
      seasonalContractEvidence([
        observation("Pas de CDI, CDD saisonnier uniquement"),
      ]).status,
    ).toBe("explicit"))
})

describe("§10 — conditions facultatives fidèles à la source", () => {
  it.each([
    ["logement fourni", "housing", "yes"],
    ["logé·e", "housing", "yes"],
    ["logement assuré", "housing", "yes"],
    ["non logé", "housing", "no"],
    ["logement non fourni", "housing", "no"],
    ["nourri·e", "meals", "yes"],
    ["repas fournis", "meals", "yes"],
    ["non nourri", "meals", "no"],
    ["repas non fournis", "meals", "no"],
    ["débutant accepté", "experienceRequired", "no"],
    ["première expérience", "experienceRequired", "no"],
    ["sans expérience", "experienceRequired", "no"],
    ["expérience exigée", "experienceRequired", "yes"],
    ["2 ans d'expérience exigés", "experienceRequired", "yes"],
    ["permis B exigé", "drivingLicenceRequired", "yes"],
    ["permis obligatoire", "drivingLicenceRequired", "yes"],
    ["permis non exigé", "drivingLicenceRequired", "no"],
    ["couples acceptés", "couplesAccepted", "yes"],
    ["couples non acceptés", "couplesAccepted", "no"],
    ["animaux autorisés", "petsAccepted", "yes"],
    ["animaux interdits", "petsAccepted", "no"],
    ["temps plein", "workTime", "full_time"],
    ["temps partiel", "workTime", "part_time"],
    ["35 h", "weeklyHours", 35],
    ["39 heures", "weeklyHours", 39],
    ["35,5 h par semaine", "weeklyHours", 35.5],
  ] as const)("mention explicite : %s", (text, key, value) =>
    expect(extractConditions([observation(text)]).fields[key]).toMatchObject({
      status: "established",
      value,
    }),
  )
  it.each([
    "logement possible",
    "possibilité de logement",
    "possibilité d'être logé",
  ])("logement possible : inconnu, jamais oui : %s", (text) => {
    const result = extractConditions([observation(text)])
    expect(result.fields.housing).toMatchObject({
      status: "to_verify",
      value: "unknown",
    })
    expect(result.precisions.housing).toBe(
      "Logement possible, à confirmer auprès de l'employeur",
    )
  })
  it("permis apprécié : inconnu avec la précision", () => {
    const result = extractConditions([observation("permis apprécié")])
    expect(result.fields.drivingLicenceRequired).toMatchObject({
      status: "to_verify",
      value: "unknown",
    })
    expect(result.precisions.drivingLicenceRequired).toContain(
      "Permis apprécié",
    )
  })
  it.each([
    "pas de logement fourni",
    "ce poste n'est pas logé",
    "pas de permis obligatoire",
    "pas de repas fournis",
  ])("une mention niée ne devient jamais oui : %s", (text) => {
    const result = extractConditions([observation(text)])
    for (const field of Object.values(result.fields))
      expect(field).not.toMatchObject({ status: "established", value: "yes" })
  })
  it("avantage général du groupe : aucune condition du poste", () =>
    expect(
      Object.values(
        extractConditions([
          observation(
            "Logement fourni, nourri, permis obligatoire",
            "conditions",
            "site",
          ),
        ]).fields,
      ).every((field) => field.status === "absent"),
    ).toBe(true))
  it("deux conditions incompatibles : valeur neutre et À confirmer", () => {
    const result = extractConditions([
      observation("logement fourni"),
      observation("non logé"),
    ])
    expect(result.fields.housing.status).toBe("contradictory")
    expect(result.fields.housing).not.toHaveProperty("value")
    expect(result.fieldsToConfirm).toContain("housing")
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "optional_contradiction",
        blocking: false,
      }),
    )
  })
  it("une donnée absente reste absente", () =>
    expect(extractConditions([]).fields.housing.status).toBe("absent"))
  it("des heures journalières ne deviennent pas des heures hebdomadaires", () =>
    expect(
      extractConditions([observation("8 heures par jour")]).fields.weeklyHours
        .status,
    ).toBe("absent"))
  it("une plage horaire ne devient pas une durée hebdomadaire", () =>
    expect(
      extractConditions([observation("Service de 8 h à 16 h")]).fields
        .weeklyHours.status,
    ).toBe("absent"))
  it("un petit nombre d'heures explicitement hebdomadaire est conservé", () =>
    expect(
      valueOf(
        extractConditions([observation("8 heures par semaine")]).fields
          .weeklyHours,
      ),
    ).toBe(8))
  it("temps partiel avec heures hebdomadaires explicites", () =>
    expect(
      valueOf(
        extractConditions([observation("20 heures hebdomadaires")]).fields
          .weeklyHours,
      ),
    ).toBe(20))
  it("des heures explicitement mensuelles ne deviennent pas hebdomadaires", () =>
    expect(
      extractConditions([observation("35 h par mois")]).fields.weeklyHours
        .status,
    ).toBe("absent"))
  it("les libellés bruts des champs d'horaires sont aussi reconnus", () => {
    const result = extractConditions([
      observation("temps plein", "workTime"),
      observation("35 h", "weeklyHours"),
    ])
    expect(valueOf(result.fields.workTime)).toBe("full_time")
    expect(valueOf(result.fields.weeklyHours)).toBe(35)
  })
})

describe("§10 — salaire : ni conversion ni base inventée", () => {
  it("un signe moins n'est pas supprimé pour créer un salaire positif", () => {
    const result = extractSalaryText([
      observation("-1800 € net par mois", "salary"),
    ])
    expect(result.field.status).toBe("absent")
    expect(valueOf(result.precision)).toBe("-1800 € net par mois")
  })
  it("la durée du contrat ne devient pas l'unité du salaire", () =>
    expect(
      extractSalaryText([
        observation("Salaire : 1800 € brut, contrat de 4 mois"),
      ]).field.status,
    ).toBe("absent"))
  it("un loyer n'est pas une rémunération", () =>
    expect(
      extractSalaryText([observation("Loyer : 300 € net par mois")]).field
        .status,
    ).toBe("absent"))
  it("la précision salariale conserve la phrase source, pas toute l'annonce", () => {
    const text =
      "Vous accueillez les clients. Salaire : 1 867 € par mois. Contact : accueil@hotel.example."
    const result = extractSalaryText([observation(text)])
    expect(valueOf(result.precision)).toBe(
      "Salaire : 1 867 € par mois, base non précisée par la source",
    )
  })
  it("les accents décomposés ne décalent pas l'extrait salarial", () => {
    const result = extractSalaryText([
      observation(
        "E\u0301quipe saisonnière. Re\u0301mune\u0301ration : 1 867 € net par mois. Logement fourni.",
      ),
    ])
    expect(valueOf(result.precision)).toBe(
      "Re\u0301mune\u0301ration : 1 867 € net par mois",
    )
  })
  it.each([
    ["1 867 € net par mois", 186700],
    ["1867,50 € net mensuel", 186750],
    ["1,867.5 € net par mois", 186750],
    ["1.867,50 € net par mois", 186750],
    ["1867 € net par mois", 186700],
    ["1\u202f867 € net par mois", 186700],
  ])("montants français et anglais : %s", (text, minCents) =>
    expect(
      extractSalaryText([observation(text, "salary")]).field,
    ).toMatchObject({
      status: "established",
      value: [{ basis: "net", unit: "month", minCents }],
    }),
  )
  it("une fourchette garde ses deux bornes", () =>
    expect(
      valueOf(
        extractSalaryText([
          observation("de 1 800 à 2 000 € brut par mois", "salary"),
        ]).field,
      ),
    ).toEqual([
      { basis: "gross", unit: "month", minCents: 180000, maxCents: 200000 },
    ]))
  it.each([
    ["12,50 € brut par heure", "hour"],
    ["100 € net par jour", "day"],
    ["500 € net par semaine", "week"],
    ["8000 € net par saison", "season"],
    ["2000 € brut au forfait", "lump_sum"],
  ])("l'unité d'origine est conservée : %s", (text, unit) =>
    expect(
      valueOf(extractSalaryText([observation(text, "salary")]).field)?.[0].unit,
    ).toBe(unit),
  )
  it("montant sans net ni brut : précision seulement", () => {
    const result = extractSalaryText([
      observation("1 867 € par mois", "salary"),
    ])
    expect(result.field.status).toBe("absent")
    expect(valueOf(result.precision)).toBe(
      "1 867 € par mois, base non précisée par la source",
    )
  })
  it("SMIC hôtelier sans montant : précision seulement", () => {
    const result = extractSalaryText([observation("SMIC hôtelier", "salary")])
    expect(result.field.status).toBe("absent")
    expect(valueOf(result.precision)).toBe("SMIC hôtelier")
  })
  it("deux salaires différents : À confirmer, aucun montant filtrable", () => {
    const result = extractSalaryText([
      observation("1800 € net par mois", "salary"),
      observation("2000 € net par mois", "salary"),
    ])
    expect(result.field.status).toBe("contradictory")
    expect(result.field).not.toHaveProperty("value")
    expect(result.issues[0].blocking).toBe(false)
  })
  it("répéter le même montant ne crée pas de contradiction", () =>
    expect(
      extractSalaryText([
        observation("1800 € net par mois", "salary"),
        observation("1 800 € net mensuel", "salary"),
      ]).field.status,
    ).toBe("established"))
  it("le net et le brut ne sont pas contradictoires entre eux", () =>
    expect(
      valueOf(
        extractSalaryText([
          observation("1800 € net par mois et 2300 € brut par mois", "salary"),
        ]).field,
      ),
    ).toHaveLength(2))
  it("le salaire général du site ne prouve pas celui du poste", () =>
    expect(
      extractSalaryText([observation("1800 € net par mois", "salary", "site")])
        .field.status,
    ).toBe("absent"))
})

describe("§10 — canal officiel et contacts généraux", () => {
  it("un email en rubrique candidature établit un canal direct", () =>
    expect(
      applicationChannelState(valueOf(extractApplication(posting())), []).state,
    ).toBe("direct"))
  it("un téléphone d'accueil reste général, jamais canal", () => {
    const application = valueOf(
      extractApplication(
        posting({
          contacts: [
            {
              kind: "phone",
              value: "04 65 71 00 00",
              role: "accueil",
              section: "Réception",
              official: true,
              evidence,
            },
          ],
        }),
      ),
    )
    expect(applicationChannelState(application, []).state).toBe("none")
    expect(application?.generalContacts[0].role).toBe("accueil")
  })
  it("applicationContact seul ne prouve pas un canal", () => {
    const input = posting()
    input.contacts[0].section = "applicationContact"
    expect(
      applicationChannelState(valueOf(extractApplication(input)), []).state,
    ).toBe("none")
  })
  it("formulaire officiel seul : candidature externe", () =>
    expect(
      applicationChannelState(
        valueOf(
          extractApplication(
            posting({
              contacts: [],
              formUrl: {
                value: "https://hotel.example/postuler",
                official: true,
                evidence,
              },
            }),
          ),
        ),
        [],
      ).state,
    ).toBe("form_only"))
  it("le téléphone général n'enlève pas le badge Candidature externe", () => {
    const input = posting({
      formUrl: {
        value: "https://hotel.example/postuler",
        official: true,
        evidence,
      },
    })
    input.contacts[0].section = "Accueil"
    expect(
      applicationChannelState(valueOf(extractApplication(input)), []).state,
    ).toBe("form_only")
  })
  it("formulaire sur un job-board : canal exclu", () =>
    expect(
      applicationChannelState(
        valueOf(
          extractApplication(
            posting({
              contacts: [],
              formUrl: {
                value: "https://jobs.jobboard.example/postuler",
                official: true,
                evidence,
              },
            }),
          ),
        ),
        ["jobboard.example"],
      ).state,
    ).toBe("blocked"))
  it("un email sur un domaine exclu bloque aussi", () => {
    const input = posting()
    input.contacts[0].value = "rh@jobboard.example"
    expect(
      applicationChannelState(valueOf(extractApplication(input)), [
        "jobboard.example",
      ]).state,
    ).toBe("blocked")
  })
  it("un formulaire non officiel ne devient pas canal", () =>
    expect(
      applicationChannelState(
        valueOf(
          extractApplication(
            posting({
              contacts: [],
              formUrl: {
                value: "https://hotel.example/postuler",
                official: false,
                evidence,
              },
            }),
          ),
        ),
        [],
      ).state,
    ).toBe("none"))
})

describe("langue et localisation sans pays inventé", () => {
  it.each([
    [
      "Nous recherchons un serveur pour notre restaurant. Vous travaillez avec notre équipe et vous accueillez les clients dans une salle agréable.",
      true,
    ],
    [
      "We are looking for a waiter for our restaurant. You will work with our team and welcome the guests in a pleasant dining room.",
      false,
    ],
    [
      "Wir suchen einen Kellner für unser Restaurant. Sie arbeiten mit unserem Team und begrüßen die Gäste in einem angenehmen Speisesaal.",
      false,
    ],
  ])("heuristique de mots outils : %s", (text, expected) =>
    expect(isFrenchText(text)).toBe(expected),
  )
  it.each([
    ["75001", "75"],
    ["01000", "01"],
    ["97100", "971"],
    ["97400", "974"],
    ["20000", "20"],
    ["98000", null],
    ["00000", null],
    ["7500", null],
    ["xxxxx", null],
  ])("département du code postal : %s", (code, expected) =>
    expect(departmentFromPostalCode(code)).toBe(expected),
  )
  it.each([
    [{ country: "France" }, true],
    [{ countryCode: "FR" }, true],
    [{ country: "Allemagne" }, false],
    [{}, null],
  ])("pays explicitement donné : %j", (place, expected) =>
    expect(isFrance(place)).toBe(expected),
  )
})
