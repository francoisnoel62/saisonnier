import { describe, expect, it } from "vitest"

import { safeNextPath, signInPath } from "./redirects"

describe("safeNextPath", () => {
  it.each(["/offres", "/employeur/annonces?page=2", "/admin#verifications"])(
    "garde le chemin interne %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path)
    },
  )

  it.each([
    "https://evil.example/offres",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "offres",
    "",
    null,
    undefined,
    ["/offres"],
  ])("refuse %j", (value) => {
    expect(safeNextPath(value)).toBeNull()
  })
})

describe("signInPath", () => {
  it("transmet la page demandée", () => {
    expect(signInPath("/employeur/annonces?page=2")).toBe(
      "/connexion?next=%2Femployeur%2Fannonces%3Fpage%3D2",
    )
  })

  it("ignore une destination absente, externe ou l'accueil", () => {
    expect(signInPath()).toBe("/connexion")
    expect(signInPath("https://evil.example")).toBe("/connexion")
    expect(signInPath("/")).toBe("/connexion")
  })
})
