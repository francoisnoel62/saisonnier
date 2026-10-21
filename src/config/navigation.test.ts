import { describe, expect, it } from "vitest"

import { activeNavItem, navigation, pageTitleFor } from "./navigation"

describe("activeNavItem", () => {
  const employer = navigation.employer

  it("retient l'entrée dont l'URL est exactement celle de la page", () => {
    expect(activeNavItem(employer, "/employeur")?.title).toBe("Tableau de bord")
  })

  it("préfère l'entrée la plus spécifique", () => {
    expect(activeNavItem(employer, "/employeur/annonces")?.title).toBe(
      "Mes annonces",
    )
    expect(activeNavItem(employer, "/employeur/annonces/nouvelle")?.title).toBe(
      "Déposer une annonce",
    )
  })

  it("rattache une sous-page à son entrée", () => {
    expect(activeNavItem(employer, "/employeur/annonces/42")?.title).toBe(
      "Mes annonces",
    )
  })

  it("ne confond pas deux URL qui partagent un préfixe", () => {
    expect(activeNavItem(navigation.candidate, "/offres-speciales")).toBe(
      undefined,
    )
  })
})

describe("pageTitleFor", () => {
  it("couvre la navigation du rôle et Mon compte", () => {
    expect(pageTitleFor("candidate", "/mes-offres")).toBe("Mes offres")
    expect(pageTitleFor("admin", "/admin/referentiels")).toBe("Référentiels")
    expect(pageTitleFor("employer", "/compte")).toBe("Mon compte")
  })

  it("ne propose rien pour une page inconnue", () => {
    expect(pageTitleFor("candidate", "/inconnue")).toBeUndefined()
  })
})
