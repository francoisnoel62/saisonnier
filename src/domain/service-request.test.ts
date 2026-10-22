import { describe, expect, it } from "vitest"

import {
  involvesIntermediation,
  serviceCommitments,
  serviceRequestSchema,
  serviceRequestUpdateSchema,
} from "./service-request"

const OFFER_ID = "5d1b7c1e-8f0a-4c3e-9b52-6f0e2a4d7c11"

const request = (values: Record<string, unknown> = {}) => ({
  services: ["screening", "questionnaire"],
  scope: "offer",
  offerId: OFFER_ID,
  scopeDetails: "",
  purchaseFormat: "single",
  message: "",
  ...values,
})

function errorsOf(values: Record<string, unknown>) {
  const result = serviceRequestSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [issue.path[0], issue.message]),
      )
}

describe("serviceRequestSchema", () => {
  it("accepte une demande sur une annonce ; les prestations suivent l'ordre du §7", () => {
    expect(serviceRequestSchema.parse(request())).toEqual({
      services: ["questionnaire", "screening"],
      scope: "offer",
      offerId: OFFER_ID,
      scopeDetails: null,
      purchaseFormat: "single",
      message: null,
    })
  })

  it("exige au moins une prestation connue, une portée et une formule", () => {
    expect(
      errorsOf(request({ services: [], scope: "", purchaseFormat: "" })),
    ).toEqual({
      services: "Cochez au moins une prestation.",
      scope: "Précisez la portée de la demande.",
      purchaseFormat: "Choisissez une formule : à l'unité ou en package.",
    })
    expect(errorsOf(request({ services: ["tarif_premium"] }))).toEqual({
      services: "Prestation inconnue.",
    })
  })

  it("une annonce se choisit dans la liste ; une campagne ou un établissement se précise", () => {
    expect(errorsOf(request({ offerId: "" }))).toEqual({
      offerId: "Choisissez l'annonce concernée.",
    })
    expect(errorsOf(request({ scope: "campaign", offerId: "" }))).toEqual({
      scopeDetails:
        "Précisez la campagne : postes, nombre de recrutements, période.",
    })
    expect(
      serviceRequestSchema.parse(
        request({
          scope: "establishment",
          scopeDetails: " Camping des Dunes, Lacanau ",
          purchaseFormat: "package",
        }),
      ),
    ).toMatchObject({
      scope: "establishment",
      // L'annonce ne vaut que pour la portée « une de mes annonces ».
      offerId: null,
      scopeDetails: "Camping des Dunes, Lacanau",
      purchaseFormat: "package",
    })
  })

  it("signale toutes les erreurs ensemble", () => {
    expect(
      errorsOf(request({ scope: "campaign", offerId: "", purchaseFormat: "" })),
    ).toEqual({
      purchaseFormat: "Choisissez une formule : à l'unité ou en package.",
      scopeDetails:
        "Précisez la campagne : postes, nombre de recrutements, période.",
    })
  })

  it("limite la longueur du message", () => {
    expect(errorsOf(request({ message: "x".repeat(3001) }))).toEqual({
      message: "Le message ne doit pas dépasser 3000 caractères.",
    })
  })
})

describe("serviceRequestUpdateSchema", () => {
  it("change le statut, avec une note interne facultative", () => {
    expect(
      serviceRequestUpdateSchema.parse({
        id: OFFER_ID,
        status: "in_progress",
        adminNote: "  ",
      }),
    ).toEqual({ id: OFFER_ID, status: "in_progress", adminNote: null })
    expect(
      serviceRequestUpdateSchema.safeParse({
        id: OFFER_ID,
        status: "paid",
        adminNote: "",
      }).success,
    ).toBe(false)
  })
})

describe("prestations", () => {
  it("le sourcing seul ne demande pas d'intermédiation ; le tri, si", () => {
    expect(involvesIntermediation(["sourcing"])).toBe(false)
    expect(involvesIntermediation(["sourcing", "screening"])).toBe(true)
  })

  it("les engagements du §7 sont tous affichés", () => {
    expect(serviceCommitments).toHaveLength(6)
    expect(serviceCommitments).toContain(
      "Aucun achat n'est nécessaire pour publier une annonce conforme.",
    )
  })
})
