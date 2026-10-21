import { describe, expect, it } from "vitest"

import * as triState from "./tri-state"
import { triLabel, triStates } from "./tri-state"

describe("triLabel", () => {
  it("affiche Oui, Non ou Non précisé", () => {
    expect(triLabel("yes")).toBe("Oui")
    expect(triLabel("no")).toBe("Non")
    expect(triLabel("unknown")).toBe("Non précisé")
  })

  it("ne confond jamais « Non précisé » avec « Non »", () => {
    expect(new Set(triStates.map(triLabel)).size).toBe(triStates.length)
  })
})

describe("tri-state", () => {
  // Une information inconnue n'est ni un oui ni un non (§3, §9) : le module n'offre aucune
  // conversion vers un booléen.
  it("n'expose aucune conversion en booléen", () => {
    expect(Object.keys(triState).sort()).toEqual(["triLabel", "triStates"])
  })
})
