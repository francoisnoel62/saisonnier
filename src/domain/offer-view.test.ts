import { describe, expect, it } from "vitest"
import { offerView, offersReturnHref, withOfferView } from "./offer-view"

describe("navigation des vues d'offres", () => {
  it("conserve critères et pagination en changeant de vue", () => {
    expect(
      withOfferView("/offres?dept=73&page=2&offre=old", "comparateur"),
    ).toBe("/offres?dept=73&page=2&vue=comparateur")
    expect(withOfferView("/offres?dept=73", "immersion", "selected")).toBe(
      "/offres?dept=73&vue=immersion&offre=selected",
    )
    expect(offerView("inconnue")).toBe("escales")
  })
  it("limite le retour au catalogue interne", () => {
    for (const unsafe of [
      "https://example.com",
      "//example.com",
      "/offres/secret",
      "/offres-malicious",
      ["/offres"],
      undefined,
    ])
      expect(offersReturnHref(unsafe)).toBe("/offres")
    expect(offersReturnHref("/offres?dept=73&vue=immersion")).toBe(
      "/offres?dept=73&vue=immersion",
    )
  })
})
