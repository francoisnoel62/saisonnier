import { describe, expect, it } from "vitest"

import { adminRepublishRefusal, canAdminUnpublish } from "./admin-offer"

const today = "2026-10-22"

describe("canAdminUnpublish", () => {
  it("vaut pour toute annonce publiée, et seulement elle", () => {
    expect(canAdminUnpublish({ status: "published" })).toBe(true)
    for (const status of [
      "pending_review",
      "unpublished",
      "expired",
      "rejected",
    ] as const) {
      expect(canAdminUnpublish({ status })).toBe(false)
    }
  })
})

describe("adminRepublishRefusal", () => {
  it("remet en ligne une annonce retirée ou expirée sans échéance dépassée", () => {
    expect(adminRepublishRefusal({ status: "unpublished" }, today)).toBeNull()
    expect(
      adminRepublishRefusal(
        { status: "expired", applicationDeadline: "2026-11-01" },
        today,
      ),
    ).toBeNull()
  })

  it("refuse tant qu'une échéance est dépassée (§6)", () => {
    expect(
      adminRepublishRefusal(
        { status: "expired", applicationDeadline: "2026-10-21" },
        today,
      ),
    ).toMatch(/date limite de candidature est passée/)
    expect(
      adminRepublishRefusal(
        { status: "unpublished", endDate: "2026-10-01" },
        today,
      ),
    ).toMatch(/date de fin du contrat est passée/)
  })

  it("ne publie ni une annonce en attente, ni une annonce refusée (H2)", () => {
    for (const status of ["pending_review", "rejected", "published"] as const) {
      expect(adminRepublishRefusal({ status }, today)).toBe(
        "Seule une annonce hors ligne ou expirée se remet en ligne.",
      )
    }
  })
})
