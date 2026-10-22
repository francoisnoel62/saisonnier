import { describe, expect, it } from "vitest"

import {
  canEditOffer,
  canUnpublishOffer,
  canViewOffer,
  employerOfferState,
  republishRefusal,
  type ManagedOfferFields,
  type OfferManager,
} from "./employer-offer"

const today = "2026-10-22"

const verified: OfferManager = {
  userId: "user-a",
  companyId: "company-1",
  status: "verified",
}
const pending: OfferManager = {
  ...verified,
  userId: "user-b",
  status: "pending",
}
const rejected: OfferManager = {
  ...verified,
  userId: "user-c",
  status: "rejected",
}

const offer = (
  fields: Partial<ManagedOfferFields> = {},
): ManagedOfferFields => ({
  origin: "deposited",
  companyId: "company-1",
  createdByUserId: "user-a",
  applicationChannel: "employer",
  status: "published",
  applicationDeadline: null,
  endDate: null,
  ...fields,
})

describe("employerOfferState", () => {
  it("une annonce publiée est en ligne tant qu'aucune échéance n'est passée", () => {
    expect(employerOfferState(offer({ endDate: today }), today)).toBe("online")
    expect(
      employerOfferState(offer({ applicationDeadline: "2026-10-21" }), today),
    ).toBe("expired")
    expect(employerOfferState(offer({ endDate: "2026-10-21" }), today)).toBe(
      "expired",
    )
  })

  it("traduit chaque statut", () => {
    expect(employerOfferState(offer({ status: "pending_review" }), today)).toBe(
      "pending_review",
    )
    expect(employerOfferState(offer({ status: "unpublished" }), today)).toBe(
      "offline",
    )
    expect(employerOfferState(offer({ status: "expired" }), today)).toBe(
      "expired",
    )
    expect(employerOfferState(offer({ status: "rejected" }), today)).toBe(
      "rejected",
    )
  })
})

describe("canViewOffer", () => {
  it("un déposant vérifié voit les annonces déposées de son entreprise", () => {
    expect(canViewOffer(verified, offer())).toBe(true)
    expect(canViewOffer(verified, offer({ createdByUserId: "user-z" }))).toBe(
      true,
    )
    expect(canViewOffer(verified, offer({ createdByUserId: null }))).toBe(true)
  })

  it("jamais une annonce collectée, ni celle d'une autre entreprise (§6)", () => {
    expect(canViewOffer(verified, offer({ origin: "collected" }))).toBe(false)
    expect(canViewOffer(verified, offer({ companyId: "company-2" }))).toBe(
      false,
    )
  })

  it("avant sa vérification, un déposant ne voit que ses propres annonces (H2)", () => {
    expect(canViewOffer(pending, offer())).toBe(false)
    expect(canViewOffer(pending, offer({ createdByUserId: "user-b" }))).toBe(
      true,
    )
    expect(canViewOffer(rejected, offer())).toBe(false)
  })
})

describe("canEditOffer", () => {
  it("un déposant vérifié modifie les annonces de son entreprise, sauf refusées", () => {
    for (const status of [
      "published",
      "unpublished",
      "expired",
      "pending_review",
    ] as const) {
      expect(canEditOffer(verified, offer({ status }))).toBe(true)
    }
    expect(canEditOffer(verified, offer({ status: "rejected" }))).toBe(false)
  })

  it("une annonce confiée au chargé de recrutement du service se modifie par le fondateur", () => {
    expect(
      canEditOffer(verified, offer({ applicationChannel: "recruiter" })),
    ).toBe(false)
  })

  it("un déposant en attente ne modifie que ses annonces en attente", () => {
    const own = { createdByUserId: "user-b" }
    expect(
      canEditOffer(pending, offer({ ...own, status: "pending_review" })),
    ).toBe(true)
    expect(canEditOffer(pending, offer({ ...own, status: "published" }))).toBe(
      false,
    )
    expect(canEditOffer(pending, offer({ status: "pending_review" }))).toBe(
      false,
    )
  })

  it("un déposant refusé ne modifie rien", () => {
    expect(
      canEditOffer(
        rejected,
        offer({ createdByUserId: "user-c", status: "rejected" }),
      ),
    ).toBe(false)
  })
})

describe("canUnpublishOffer", () => {
  it("seule une annonce publiée se met hors ligne, par un déposant vérifié", () => {
    expect(canUnpublishOffer(verified, offer())).toBe(true)
    expect(canUnpublishOffer(verified, offer({ status: "unpublished" }))).toBe(
      false,
    )
    expect(
      canUnpublishOffer(pending, offer({ createdByUserId: "user-b" })),
    ).toBe(false)
    expect(canUnpublishOffer(verified, offer({ origin: "collected" }))).toBe(
      false,
    )
  })
})

describe("republishRefusal", () => {
  it("remet en ligne une annonce retirée ou expirée dont les dates sont valables", () => {
    expect(
      republishRefusal(verified, offer({ status: "unpublished" }), today),
    ).toBeNull()
    expect(
      republishRefusal(
        verified,
        offer({ status: "expired", applicationDeadline: today }),
        today,
      ),
    ).toBeNull()
  })

  it("refuse tant que les dates n'ont pas été corrigées (§6)", () => {
    expect(
      republishRefusal(
        verified,
        offer({ status: "expired", applicationDeadline: "2026-10-21" }),
        today,
      ),
    ).toBe(
      "La date limite de candidature est passée : modifiez-la avant de remettre l'annonce en ligne.",
    )
    expect(
      republishRefusal(
        verified,
        offer({ status: "unpublished", endDate: "2026-10-01" }),
        today,
      ),
    ).toBe(
      "La date de fin du contrat est passée : modifiez-la avant de remettre l'annonce en ligne.",
    )
  })

  it("refuse une annonce en ligne, en attente ou refusée, et tout déposant non vérifié", () => {
    const refusal = "Cette annonce ne peut pas être remise en ligne."
    for (const status of ["published", "pending_review", "rejected"] as const) {
      expect(republishRefusal(verified, offer({ status }), today)).toBe(refusal)
    }
    expect(
      republishRefusal(
        pending,
        offer({ createdByUserId: "user-b", status: "unpublished" }),
        today,
      ),
    ).toBe(refusal)
  })
})
