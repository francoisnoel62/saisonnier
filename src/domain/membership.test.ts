import { describe, expect, it } from "vitest"

import {
  canPublishDirectly,
  companyDetailsSchema,
  companyOnboardingSchema,
  emailMatchesWebsite,
  isValidSiren,
  isValidSiret,
  membershipDecisionSchema,
  membershipStatuses,
  relationshipLabel,
  websiteHost,
} from "./membership"
import { isTourismActivity, nafLabel } from "./naf"

describe("canPublishDirectly", () => {
  it("n'est vrai que pour un rattachement vérifié", () => {
    expect(
      membershipStatuses.filter((status) => canPublishDirectly(status)),
    ).toEqual(["verified"])
  })

  it("est faux sans rattachement", () => {
    expect(canPublishDirectly(null)).toBe(false)
  })
})

describe("emailMatchesWebsite", () => {
  it("compare le domaine de l'email à celui du site, sans « www. » ni protocole", () => {
    expect(
      emailMatchesWebsite("rh@hotel-du-lac.fr", "https://www.hotel-du-lac.fr/"),
    ).toBe(true)
    expect(emailMatchesWebsite("rh@hotel-du-lac.fr", "hotel-du-lac.fr")).toBe(
      true,
    )
    expect(
      emailMatchesWebsite("RH@Hotel-du-Lac.FR", "http://WWW.hotel-du-lac.fr"),
    ).toBe(true)
  })

  it("accepte un sous-domaine de part ou d'autre", () => {
    expect(
      emailMatchesWebsite("rh@mail.hotel-du-lac.fr", "www.hotel-du-lac.fr"),
    ).toBe(true)
    expect(
      emailMatchesWebsite("rh@hotel-du-lac.fr", "https://ete.hotel-du-lac.fr"),
    ).toBe(true)
  })

  it("refuse un autre domaine, même ressemblant", () => {
    expect(emailMatchesWebsite("rh@gmail.com", "www.hotel-du-lac.fr")).toBe(
      false,
    )
    expect(
      emailMatchesWebsite("rh@faux-hotel-du-lac.fr", "www.hotel-du-lac.fr"),
    ).toBe(false)
    expect(
      emailMatchesWebsite("rh@hotel-du-lac.fr.example", "hotel-du-lac.fr"),
    ).toBe(false)
  })

  it("est faux sans site ou avec un site illisible", () => {
    expect(emailMatchesWebsite("rh@hotel-du-lac.fr", null)).toBe(false)
    expect(emailMatchesWebsite("rh@hotel-du-lac.fr", "")).toBe(false)
    expect(emailMatchesWebsite("rh@hotel-du-lac.fr", "pas un site")).toBe(false)
    expect(websiteHost("localhost")).toBeNull()
  })
})

describe("SIREN et SIRET", () => {
  it("vérifie la clé de Luhn", () => {
    expect(isValidSiren("844190652")).toBe(true)
    expect(isValidSiren("844190653")).toBe(false)
    expect(isValidSiren("84419065")).toBe(false)
    expect(isValidSiret("84419065200025")).toBe(true)
    expect(isValidSiret("84419065200026")).toBe(false)
  })

  it("accepte les établissements de La Poste, hors clé de Luhn", () => {
    expect(isValidSiren("356000000")).toBe(true)
    expect(isValidSiret("35600000000048")).toBe(true)
  })
})

describe("NAF", () => {
  it("donne le libellé des activités du tourisme et des loisirs", () => {
    expect(nafLabel("55.10Z")).toBe("Hôtels et hébergement similaire")
    expect(isTourismActivity("93.29Z")).toBe(true)
  })

  it("ne devine rien hors de la liste", () => {
    expect(nafLabel("47.59A")).toBeNull()
    expect(isTourismActivity(null)).toBe(false)
  })
})

describe("relationshipLabel", () => {
  it("affiche la précision de « autre »", () => {
    expect(relationshipLabel("hr", null)).toBe("RH / recrutement")
    expect(relationshipLabel("other", "Gérant saisonnier")).toBe(
      "Autre : Gérant saisonnier",
    )
  })
})

const onboarding = {
  legalName: "Hôtel du Lac",
  siren: "844 190 652",
  siret: "84419065200025",
  nafCode: "55.10z",
  nafLabel: "Hôtels et hébergement similaire",
  communeName: "Annecy",
  displayName: "",
  website: "www.hotel-du-lac.fr",
  jobTitle: "Directrice",
  relationship: "executive",
  relationshipDetails: "ignorée",
  phone: "04 65 71 12 34",
  certified: true,
}

describe("companyOnboardingSchema", () => {
  it("normalise SIREN, code NAF, site et textes absents", () => {
    expect(companyOnboardingSchema.parse(onboarding)).toMatchObject({
      siren: "844190652",
      nafCode: "55.10Z",
      website: "https://www.hotel-du-lac.fr",
      displayName: null,
      relationshipDetails: null,
    })
  })

  it("exige un SIREN valide et un SIRET de la même entreprise", () => {
    const errors = (input: object) =>
      companyOnboardingSchema.safeParse({ ...onboarding, ...input }).error
        ?.issues[0]?.path
    expect(errors({ siren: "" })).toEqual(["siren"])
    expect(errors({ siren: "123456789" })).toEqual(["siren"])
    expect(errors({ siret: "35600000000048" })).toEqual(["siret"])
    expect(errors({ siret: "" })).toBeUndefined()
  })

  it("exige la précision de « autre » et la certification", () => {
    const result = companyOnboardingSchema.safeParse({
      ...onboarding,
      relationship: "other",
      relationshipDetails: " ",
    })
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "relationshipDetails",
    ])
    expect(
      companyOnboardingSchema.safeParse({ ...onboarding, certified: false })
        .error?.issues[0]?.path,
    ).toEqual(["certified"])
  })

  it("refuse un site illisible et un téléphone invalide", () => {
    const result = companyDetailsSchema.safeParse({
      displayName: "",
      website: "pas un site",
      phone: "12",
    })
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "website",
      "phone",
    ])
  })
})

describe("membershipDecisionSchema", () => {
  it("exige le motif d'un refus", () => {
    expect(
      membershipDecisionSchema.safeParse({ decision: "verify", userId: "u1" })
        .success,
    ).toBe(true)
    expect(
      membershipDecisionSchema.safeParse({
        decision: "reject",
        userId: "u1",
        reviewNote: "  ",
      }).success,
    ).toBe(false)
  })
})
