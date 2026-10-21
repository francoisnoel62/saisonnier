import { describe, expect, it } from "vitest"

import { offerStatuses } from "./offer"
import {
  assertIsoDate,
  expiryReason,
  isActive,
  isIsoDate,
  todayInParis,
} from "./offer-activity"

const today = "2026-10-21"
const yesterday = "2026-10-20"
const tomorrow = "2026-10-22"

describe("todayInParis", () => {
  it("donne la date du jour à Paris", () => {
    expect(todayInParis(new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-21")
  })

  it("passe au lendemain à minuit, heure de Paris (heure d'été, UTC+2)", () => {
    expect(todayInParis(new Date("2026-10-21T21:59:59Z"))).toBe("2026-10-21")
    expect(todayInParis(new Date("2026-10-21T22:00:00Z"))).toBe("2026-10-22")
  })

  it("passe au lendemain à minuit, heure de Paris (heure d'hiver, UTC+1)", () => {
    expect(todayInParis(new Date("2026-12-31T22:59:59Z"))).toBe("2026-12-31")
    expect(todayInParis(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01")
  })
})

describe("isIsoDate", () => {
  it.each(["2026-10-21", "2024-02-29", "2027-01-01"])("accepte %s", (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-10-1",
    "21/10/2026",
    "2026-10-21T00:00:00.000Z",
    "",
  ])("refuse %j", (value) => {
    expect(isIsoDate(value)).toBe(false)
  })

  it("assertIsoDate rejette un horodatage, qui fausserait les comparaisons", () => {
    expect(() => assertIsoDate(new Date().toISOString())).toThrow(
      "Date attendue au format AAAA-MM-JJ",
    )
  })
})

describe("expiryReason", () => {
  it("une date limite égale à aujourd'hui laisse l'offre active", () => {
    expect(expiryReason({ applicationDeadline: today }, today)).toBeNull()
  })

  it("une date limite dépassée retire l'offre", () => {
    expect(expiryReason({ applicationDeadline: yesterday }, today)).toBe(
      "deadline",
    )
  })

  it("une fin de contrat hier la rend inactive", () => {
    expect(expiryReason({ endDate: yesterday }, today)).toBe("end_date")
  })

  it("une fin de contrat aujourd'hui la laisse active", () => {
    expect(expiryReason({ endDate: today }, today)).toBeNull()
  })

  it("un début de contrat hier la laisse active (§6)", () => {
    const offer = {
      startDate: yesterday,
      endDate: tomorrow,
      applicationDeadline: null,
    }
    expect(expiryReason(offer, today)).toBeNull()
  })

  it("donne la date limite en premier quand les deux échéances sont dépassées", () => {
    expect(
      expiryReason(
        { applicationDeadline: "2026-09-01", endDate: yesterday },
        today,
      ),
    ).toBe("deadline")
  })

  it("une offre sans échéance n'expire pas", () => {
    expect(
      expiryReason({ applicationDeadline: null, endDate: null }, today),
    ).toBeNull()
    expect(expiryReason({}, today)).toBeNull()
  })

  it("refuse une date du jour mal formée", () => {
    expect(() =>
      expiryReason({ endDate: today }, "2026-10-21T22:30:00.000Z"),
    ).toThrow()
  })
})

describe("isActive", () => {
  it("une offre publiée sans échéance dépassée est active", () => {
    expect(isActive({ status: "published", endDate: tomorrow }, today)).toBe(
      true,
    )
  })

  it.each(offerStatuses.filter((status) => status !== "published"))(
    "une offre « %s » n'est jamais active",
    (status) => {
      expect(isActive({ status, endDate: tomorrow }, today)).toBe(false)
    },
  )

  it("une offre publiée dont l'échéance est passée n'est plus active", () => {
    expect(
      isActive({ status: "published", applicationDeadline: yesterday }, today),
    ).toBe(false)
    expect(isActive({ status: "published", endDate: yesterday }, today)).toBe(
      false,
    )
  })
})
