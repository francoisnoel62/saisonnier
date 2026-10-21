import { describe, expect, it } from "vitest"

import { homePathFor, isRole, roles } from "./roles"

describe("isRole", () => {
  it("accepte les trois rôles du service", () => {
    expect(roles.every(isRole)).toBe(true)
  })

  it.each([
    "Admin",
    "user",
    "",
    " candidate",
    null,
    undefined,
    0,
    ["admin"],
    { role: "admin" },
  ])("refuse %j", (value) => {
    expect(isRole(value)).toBe(false)
  })
})

describe("homePathFor", () => {
  it("envoie chaque rôle vers son accueil", () => {
    expect(homePathFor("candidate")).toBe("/offres")
    expect(homePathFor("employer")).toBe("/employeur")
    expect(homePathFor("admin")).toBe("/admin")
  })
})
