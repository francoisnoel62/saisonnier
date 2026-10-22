import { describe, expect, it } from "vitest"

import { checkPublicationMinimum } from "./offer-minimum"
import {
  centsToEuros,
  emptyOfferFormValues,
  eurosToCents,
  normalizeWebUrl,
  offerInputSchema,
  offerToFormValues,
  previewOfferInput,
  publicationInputOf,
  type OfferFormField,
  type OfferFormValues,
  type OfferInput,
} from "./offer-input"

const OCCUPATION_ID = "5d1b7c1e-8f0a-4c3e-9b52-6f0e2a4d7c11"

const context = {
  today: "2026-10-22",
  blockedDomains: [
    "indeed.com",
    "indeed.fr",
    "indeedemail.com",
    "linkedin.com",
  ],
  occupationIds: [OCCUPATION_ID],
  departmentCodes: ["2A", "74", "88", "971"],
}
const schema = offerInputSchema(context)

// Annonce minimale : l'intitulé, le contrat saisonnier, le lieu, la durée et un email (§3).
const minimal = (values: Partial<OfferFormValues> = {}): OfferFormValues => ({
  ...emptyOfferFormValues(),
  title: "Serveur / serveuse",
  seasonalContract: true,
  season: "winter",
  periodKind: "duration",
  durationValue: "3",
  durationUnit: "months",
  communeName: "Gérardmer",
  communeInseeCode: "88196",
  postalCode: "88400",
  departmentCode: "88",
  applyEmail: "rh@hotel-du-lac.example",
  ...values,
})

const parse = (values: Partial<OfferFormValues>) =>
  schema.parse(minimal(values))

// Erreurs par champ, dans l'ordre : { champ: [messages] }.
function errorsOf(values: OfferFormValues) {
  const result = schema.safeParse(values)
  if (result.success) return {}
  const errors: Partial<Record<OfferFormField, string[]>> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as OfferFormField
    errors[field] = [...(errors[field] ?? []), issue.message]
  }
  return errors
}

describe("eurosToCents", () => {
  it.each([
    ["1850", 185_000],
    ["1 850", 185_000],
    ["1\u00a0850", 185_000],
    ["1\u202f850,50", 185_050],
    ["12,5", 1_250],
    ["12.50", 1_250],
    ["19,99", 1_999],
    ["0,07", 7],
    ["2 000 €", 200_000],
    ["2000€", 200_000],
  ])("« %s » vaut %i centimes", (text, cents) => {
    expect(eurosToCents(text)).toBe(cents)
  })

  it.each(["", "abc", "-5", "12,505", "1.850", "1,850", "€", "12 € 50", "1e3"])(
    "refuse « %s »",
    (text) => {
      expect(eurosToCents(text)).toBeNull()
    },
  )

  it("revient à la saisie d'origine pour modifier une annonce", () => {
    expect(centsToEuros(185_000)).toBe("1850")
    expect(centsToEuros(1_250)).toBe("12,50")
    expect(centsToEuros(7)).toBe("0,07")
    for (const cents of [1, 99, 100, 1_999, 185_050, 10_000_000]) {
      expect(eurosToCents(centsToEuros(cents))).toBe(cents)
    }
  })
})

describe("offerInputSchema — champs vides", () => {
  it("convertit une annonce minimale en colonnes : tout le reste est null ou « Non précisé »", () => {
    expect(parse({})).toEqual({
      title: "Serveur / serveuse",
      occupationId: null,
      description: null,
      missions: null,
      season: "winter",
      startDate: null,
      endDate: null,
      durationValue: 3,
      durationUnit: "months",
      applicationDeadline: null,
      communeName: "Gérardmer",
      communeInseeCode: "88196",
      postalCode: "88400",
      departmentCode: "88",
      locationDetails: null,
      salaryNetMinCents: null,
      salaryNetMaxCents: null,
      salaryNetUnit: null,
      salaryGrossMinCents: null,
      salaryGrossMaxCents: null,
      salaryGrossUnit: null,
      salaryNotes: null,
      housing: "unknown",
      housingDetails: null,
      meals: "unknown",
      mealsDetails: null,
      experienceRequired: "unknown",
      experienceDetails: null,
      languagesRequired: "unknown",
      languages: [],
      drivingLicenseRequired: "unknown",
      drivingLicenseDetails: null,
      workTime: "unknown",
      weeklyHours: null,
      scheduleDetails: null,
      couplesWelcome: "unknown",
      petsAllowed: "unknown",
      otherConstraints: null,
      applyEmail: "rh@hotel-du-lac.example",
      applyPhone: null,
      applyUrl: null,
    } satisfies OfferInput)
  })

  it("une réponse vide ou absente devient « Non précisé », jamais « Non »", () => {
    const triStateFields = [
      "housing",
      "meals",
      "experienceRequired",
      "languagesRequired",
      "drivingLicenseRequired",
      "couplesWelcome",
      "petsAllowed",
    ] as const
    for (const empty of ["", undefined]) {
      const output = parse(
        Object.fromEntries(triStateFields.map((field) => [field, empty])),
      )
      for (const field of triStateFields) expect(output[field]).toBe("unknown")
      expect(Object.values(output)).not.toContain("no")
    }
    expect(parse({ workTime: "" }).workTime).toBe("unknown")
  })

  it("un texte fait d'espaces devient null, jamais une chaîne vide", () => {
    const output = parse({
      description: "   ",
      housingDetails: "\n\t ",
      applyPhone: "  ",
      locationDetails: " ",
    })
    expect(output).toMatchObject({
      description: null,
      housingDetails: null,
      applyPhone: null,
      locationDetails: null,
    })
  })

  it("garde les réponses données, « Non » compris", () => {
    expect(
      parse({ housing: "yes", meals: "no", couplesWelcome: "no" }),
    ).toMatchObject({ housing: "yes", meals: "no", couplesWelcome: "no" })
  })

  it("retire les espaces de bord et le caractère NUL, refusé par Postgres", () => {
    expect(parse({ title: "  Serveur\0  " }).title).toBe("Serveur")
  })

  it("refuse une réponse hors de Oui / Non / Non précisé", () => {
    expect(errorsOf(minimal({ housing: "maybe" }))).toEqual({
      housing: ["Réponse invalide."],
    })
  })
})

describe("offerInputSchema — minimum de publication", () => {
  it("affiche ensemble toutes les erreurs d'un formulaire vide", () => {
    expect(errorsOf(emptyOfferFormValues())).toEqual({
      title: ["Indiquez l'intitulé du poste."],
      seasonalContract: [
        "Cochez cette case : seuls les contrats saisonniers peuvent être publiés.",
      ],
      season: ["Choisissez la saison : été ou hiver."],
      communeName: ["Indiquez la commune du poste."],
      startDate: ["Indiquez la date de début du contrat."],
      endDate: ["Indiquez la date de fin du contrat."],
      applyEmail: [
        "Indiquez un email ou un téléphone : les candidats doivent pouvoir vous joindre directement.",
      ],
    })
  })

  it("accepte un téléphone seul comme moyen de candidature", () => {
    expect(
      parse({ applyEmail: "", applyPhone: "04 65 71 12 34" }),
    ).toMatchObject({ applyEmail: null, applyPhone: "04 65 71 12 34" })
  })

  it("le lien officiel ne suffit pas : il faut un email ou un téléphone (H9)", () => {
    expect(
      errorsOf(
        minimal({
          applyEmail: "",
          applyUrl: "https://www.hotel.example/emplois",
        }),
      ),
    ).toEqual({
      applyEmail: [
        "Indiquez un email ou un téléphone : les candidats doivent pouvoir vous joindre directement.",
      ],
    })
  })

  it("refuse un email ou un téléphone mal formé", () => {
    expect(
      errorsOf(minimal({ applyEmail: "rh@", applyPhone: "12 34" })),
    ).toEqual({
      applyEmail: ["Saisissez une adresse email valide."],
      applyPhone: ["Saisissez un numéro de téléphone valide."],
    })
  })

  it("refuse un métier hors du référentiel", () => {
    expect(
      errorsOf(
        minimal({ occupationId: "8c0e5c2a-0000-4000-8000-000000000000" }),
      ),
    ).toEqual({ occupationId: ["Choisissez un métier de la liste."] })
    expect(parse({ occupationId: OCCUPATION_ID }).occupationId).toBe(
      OCCUPATION_ID,
    )
  })
})

describe("offerInputSchema — période", () => {
  it("des dates précises : début et fin, dans l'ordre, sans durée", () => {
    expect(
      parse({
        periodKind: "dates",
        startDate: "2026-12-12",
        endDate: "2027-04-18",
        // Saisie de l'autre mode, masquée : elle est écartée sans bloquer.
        durationValue: "abc",
        durationUnit: "weeks",
      }),
    ).toMatchObject({
      startDate: "2026-12-12",
      endDate: "2027-04-18",
      durationValue: null,
      durationUnit: null,
    })
    expect(
      errorsOf(
        minimal({
          periodKind: "dates",
          startDate: "2027-04-18",
          endDate: "2026-12-12",
        }),
      ),
    ).toEqual({ endDate: ["La date de fin doit suivre la date de début."] })
  })

  it("une durée, éventuellement avec la date de début, mais sans date de fin", () => {
    expect(
      parse({ startDate: "2026-12-12", endDate: "2027-04-18" }),
    ).toMatchObject({
      startDate: "2026-12-12",
      endDate: null,
      durationValue: 3,
      durationUnit: "months",
    })
  })

  it("une durée entière, dans des limites plausibles", () => {
    expect(errorsOf(minimal({ durationValue: "2,5" }))).toEqual({
      durationValue: ["Indiquez un nombre entier, par exemple 3."],
    })
    expect(errorsOf(minimal({ durationValue: "13" }))).toEqual({
      durationValue: ["La durée doit être comprise entre 1 et 12 mois."],
    })
    expect(
      errorsOf(minimal({ durationValue: "0", durationUnit: "weeks" })),
    ).toEqual({
      durationValue: ["La durée doit être comprise entre 1 et 52 semaines."],
    })
    expect(errorsOf(minimal({ durationUnit: "" }))).toEqual({
      durationUnit: ["Précisez l'unité : semaines ou mois."],
    })
  })

  it("refuse une échéance déjà passée, mais accepte une date de début passée (§6)", () => {
    expect(
      errorsOf(
        minimal({
          periodKind: "dates",
          startDate: "2026-06-01",
          endDate: "2026-10-21",
          applicationDeadline: "2026-10-21",
        }),
      ),
    ).toEqual({
      endDate: ["La date de fin du contrat est déjà passée."],
      applicationDeadline: ["La date limite de candidature est déjà passée."],
    })
    // Le jour même, l'échéance est encore valable.
    expect(
      parse({
        periodKind: "dates",
        startDate: "2026-06-01",
        endDate: "2026-10-22",
        applicationDeadline: "2026-10-22",
      }),
    ).toMatchObject({ startDate: "2026-06-01", endDate: "2026-10-22" })
  })

  it("la date limite de candidature précède la fin du contrat", () => {
    expect(
      errorsOf(
        minimal({
          periodKind: "dates",
          startDate: "2026-12-12",
          endDate: "2027-04-18",
          applicationDeadline: "2027-05-01",
        }),
      ),
    ).toEqual({
      applicationDeadline: [
        "La date limite de candidature doit précéder la fin du contrat.",
      ],
    })
  })

  it("refuse une date mal formée", () => {
    expect(
      errorsOf(
        minimal({ startDate: "2026-02-30", applicationDeadline: "demain" }),
      ),
    ).toEqual({
      startDate: ["Date invalide."],
      applicationDeadline: ["Date invalide."],
    })
  })
})

describe("offerInputSchema — lieu", () => {
  it("garde la commune de geo.api.gouv.fr et son département", () => {
    expect(
      parse({
        communeName: "Ajaccio",
        communeInseeCode: "2A004",
        postalCode: "20000",
        departmentCode: "2A",
      }),
    ).toMatchObject({ communeInseeCode: "2A004", departmentCode: "2A" })
  })

  it("accepte une commune saisie à la main, avec son département", () => {
    expect(
      parse({ communeInseeCode: "", postalCode: "", departmentCode: "74" }),
    ).toMatchObject({
      communeName: "Gérardmer",
      communeInseeCode: null,
      postalCode: null,
      departmentCode: "74",
    })
    expect(
      errorsOf(
        minimal({ communeInseeCode: "", postalCode: "", departmentCode: "" }),
      ),
    ).toEqual({ departmentCode: ["Choisissez le département du poste."] })
  })

  it("refuse une commune qui n'appartient pas au département (contrainte en base)", () => {
    const reselect = [
      "Commune non reconnue : choisissez-la à nouveau dans la liste.",
    ]
    expect(errorsOf(minimal({ departmentCode: "74" }))).toEqual({
      communeName: reselect,
    })
    expect(errorsOf(minimal({ departmentCode: "99" }))).toEqual({
      communeName: reselect,
    })
    expect(errorsOf(minimal({ postalCode: "8840" }))).toEqual({
      communeName: reselect,
    })
  })
})

describe("offerInputSchema — rémunération", () => {
  it("convertit les euros en centimes, chaque base dans son unité", () => {
    expect(
      parse({
        salaryNetMin: "1 850",
        salaryNetUnit: "month",
        salaryGrossMin: "12,5",
        salaryGrossMax: "13",
        salaryGrossUnit: "hour",
      }),
    ).toMatchObject({
      salaryNetMinCents: 185_000,
      salaryNetMaxCents: null,
      salaryNetUnit: "month",
      salaryGrossMinCents: 1_250,
      salaryGrossMaxCents: 1_300,
      salaryGrossUnit: "hour",
    })
  })

  it("une unité sans montant n'est pas un salaire", () => {
    expect(parse({ salaryNetUnit: "month" })).toMatchObject({
      salaryNetMinCents: null,
      salaryNetUnit: null,
    })
  })

  it("un montant exige son unité, et une fourchette va du bas vers le haut", () => {
    expect(
      errorsOf(
        minimal({
          salaryNetMin: "1850",
          salaryGrossMin: "2000",
          salaryGrossMax: "1900",
          salaryGrossUnit: "month",
        }),
      ),
    ).toEqual({
      salaryNetUnit: ["Précisez l'unité : heure, mois, saison…"],
      salaryGrossMax: [
        "Le haut de la fourchette doit être supérieur ou égal au bas.",
      ],
    })
    expect(
      errorsOf(minimal({ salaryNetMax: "2000", salaryNetUnit: "month" })),
    ).toEqual({
      salaryNetMin: ["Indiquez le montant, ou le bas de la fourchette."],
    })
  })

  it("refuse un montant ambigu, nul ou démesuré", () => {
    expect(
      errorsOf(
        minimal({
          salaryNetMin: "1.850",
          salaryNetUnit: "month",
          salaryGrossMin: "0",
          salaryGrossUnit: "month",
        }),
      ),
    ).toEqual({
      salaryNetMin: [
        "Saisissez un montant en euros, par exemple 1 850 ou 12,50.",
      ],
      salaryGrossMin: ["Le montant doit être supérieur à zéro."],
    })
    expect(
      errorsOf(minimal({ salaryNetMin: "150000", salaryNetUnit: "season" })),
    ).toEqual({
      salaryNetMin: ["Ce montant semble trop élevé : vérifiez la saisie."],
    })
  })
})

describe("offerInputSchema — profil et organisation", () => {
  it("les langues ne sont listées que si elles sont exigées (H6)", () => {
    expect(
      parse({ languagesRequired: "yes", languages: ["de", "en"] }).languages,
    ).toEqual(["en", "de"])
    expect(parse({ languagesRequired: "no", languages: ["en"] })).toMatchObject(
      { languagesRequired: "no", languages: [] },
    )
    expect(
      errorsOf(minimal({ languagesRequired: "yes", languages: [] })),
    ).toEqual({ languages: ["Cochez au moins une langue exigée."] })
    expect(
      errorsOf(minimal({ languagesRequired: "yes", languages: ["xx"] })),
    ).toEqual({ languages: ["Langue inconnue."] })
  })

  it("lit les heures hebdomadaires au format français", () => {
    expect(parse({ weeklyHours: "37,5" }).weeklyHours).toBe(37.5)
    expect(parse({ weeklyHours: "35" }).weeklyHours).toBe(35)
    expect(errorsOf(minimal({ weeklyHours: "35h" }))).toEqual({
      weeklyHours: ["Indiquez un nombre d'heures, par exemple 35 ou 37,5."],
    })
    expect(errorsOf(minimal({ weeklyHours: "0" }))).toEqual({
      weeklyHours: ["Indiquez entre 1 et 60 heures par semaine."],
    })
  })
})

describe("offerInputSchema — destinations de candidature (§2, §9)", () => {
  it("refuse un lien vers indeed.fr, en le disant", () => {
    expect(
      errorsOf(minimal({ applyUrl: "https://www.indeed.fr/emplois/123" })),
    ).toEqual({
      applyUrl: [
        "Les liens vers indeed.fr ne sont pas acceptés : indiquez un contact direct de l'entreprise.",
      ],
    })
  })

  it("refuse un email @indeedemail.com", () => {
    expect(
      errorsOf(minimal({ applyEmail: "candidature-42@indeedemail.com" })),
    ).toEqual({
      applyEmail: [
        "Les adresses @indeedemail.com ne sont pas acceptées : indiquez un contact direct de l'entreprise.",
      ],
    })
  })

  it("refuse un sous-domaine d'un domaine exclu, même sans protocole", () => {
    expect(
      errorsOf(minimal({ applyUrl: "FR.Indeed.com/viewjob?jk=1" })),
    ).toEqual({
      applyUrl: [
        "Les liens vers indeed.com ne sont pas acceptés : indiquez un contact direct de l'entreprise.",
      ],
    })
  })

  it("complète un lien sans protocole, et refuse ce qui n'est pas une page web", () => {
    expect(
      parse({ applyUrl: "www.hotel-du-lac.example/emplois" }).applyUrl,
    ).toBe("https://www.hotel-du-lac.example/emplois")
    const notAPage = [
      "Saisissez l'adresse complète d'une page web, par exemple https://www.mon-hotel.fr/emplois.",
    ]
    for (const applyUrl of [
      "mailto:rh@hotel.example",
      "javascript:alert(1)",
      "https://rh:secret@hotel.example",
      "hotel",
    ]) {
      expect(errorsOf(minimal({ applyUrl }))).toEqual({ applyUrl: notAPage })
    }
  })

  it("normalizeWebUrl ne garde que les pages http(s)", () => {
    expect(normalizeWebUrl("HTTP://www.hotel.example")).toBe(
      "HTTP://www.hotel.example",
    )
    expect(normalizeWebUrl("  ")).toBeNull()
    expect(normalizeWebUrl("ftp://hotel.example")).toBeNull()
  })
})

describe("offerToFormValues", () => {
  const full = parse({
    occupationId: OCCUPATION_ID,
    description: "Service en salle.",
    missions: "Mise en place, service, débarrassage.",
    periodKind: "dates",
    startDate: "2026-12-12",
    endDate: "2027-04-18",
    applicationDeadline: "2026-11-30",
    locationDetails: "Au bord du lac",
    salaryNetMin: "1 850,50",
    salaryNetMax: "2000",
    salaryNetUnit: "month",
    salaryGrossMin: "12,5",
    salaryGrossUnit: "hour",
    salaryNotes: "Pourboires partagés",
    housing: "yes",
    housingDetails: "Chambre individuelle",
    meals: "no",
    experienceRequired: "yes",
    experienceDetails: "Une saison",
    languagesRequired: "yes",
    languages: ["en", "de"],
    drivingLicenseRequired: "no",
    workTime: "full_time",
    weeklyHours: "37,5",
    scheduleDetails: "Coupure l'après-midi",
    couplesWelcome: "yes",
    petsAllowed: "no",
    otherConstraints: "Tenue fournie",
    applyPhone: "04 65 71 12 34",
    applyUrl: "https://www.hotel-du-lac.example/emplois",
  })

  it("une annonce relue puis enregistrée sans modification reste identique", () => {
    expect(schema.parse(offerToFormValues(full))).toEqual(full)
    const byDuration = parse({ startDate: "2026-12-12" })
    expect(schema.parse(offerToFormValues(byDuration))).toEqual(byDuration)
  })

  it("une annonce aux dates précises s'édite par ses dates, sinon par sa durée", () => {
    expect(offerToFormValues(full)).toMatchObject({
      periodKind: "dates",
      salaryNetMin: "1850,50",
      weeklyHours: "37,5",
      seasonalContract: true,
    })
    expect(offerToFormValues(parse({}))).toMatchObject({
      periodKind: "duration",
      durationValue: "3",
      durationUnit: "months",
      endDate: "",
    })
  })
})

describe("publicationInputOf", () => {
  const minimum = (values: OfferFormValues) =>
    checkPublicationMinimum(publicationInputOf(values, "company-id"), {
      origin: "deposited",
      blockedDomains: context.blockedDomains,
    })

  it("une annonce minimale satisfait le minimum de publication", () => {
    expect(minimum(minimal())).toEqual({ ok: true, missing: [] })
  })

  it("seuls les moyens de candidature valides comptent", () => {
    expect(
      minimum(minimal({ applyEmail: "rh@" })).missing.map((m) => m.requirement),
    ).toEqual(["application"])
  })

  it("signale en direct un email vers un domaine exclu", () => {
    expect(
      minimum(minimal({ applyEmail: "x@indeedemail.com" })).missing.map(
        (m) => m.label,
      ),
    ).toEqual([
      "Un moyen de candidature direct : email ou téléphone",
      "Les adresses @indeedemail.com ne sont pas acceptées : indiquez un contact direct de l'entreprise.",
    ])
  })

  it("ne compte que la période du type choisi", () => {
    const requirements = (values: OfferFormValues) =>
      minimum(values).missing.map((m) => m.requirement)
    expect(
      requirements(minimal({ periodKind: "dates", startDate: "2026-12-12" })),
    ).toEqual(["period"])
    expect(requirements(minimal({ durationValue: "99" }))).toEqual(["period"])
  })
})

describe("previewOfferInput", () => {
  it("montre une saisie valide exactement comme elle sera enregistrée", () => {
    const values = minimal({
      periodKind: "dates",
      startDate: "2026-12-12",
      endDate: "2027-04-18",
      salaryNetMin: "1 850",
      salaryNetUnit: "month",
      housing: "yes",
      languagesRequired: "yes",
      languages: ["de", "en"],
      weeklyHours: "39",
      applyUrl: "www.hotel-du-lac.example/emplois",
    })
    expect(previewOfferInput(values)).toEqual(schema.parse(values))
  })

  it("laisse vide ce qui manque ou reste invalide, sans rien inventer", () => {
    const preview = previewOfferInput({
      ...emptyOfferFormValues(),
      salaryNetMin: "1.850",
      salaryNetUnit: "month",
      salaryGrossUnit: "hour",
      weeklyHours: "99",
      applyEmail: "rh@",
    })
    expect(preview).toMatchObject({
      title: "",
      season: null,
      communeName: "",
      startDate: null,
      endDate: null,
      durationValue: null,
      salaryNetMinCents: null,
      salaryNetUnit: null,
      salaryGrossUnit: null,
      weeklyHours: null,
      applyEmail: null,
      housing: "unknown",
      workTime: "unknown",
    })
    expect(Object.values(preview)).not.toContain("no")
  })
})
