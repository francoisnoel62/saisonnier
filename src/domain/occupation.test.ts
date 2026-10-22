import { describe, expect, it } from "vitest"

import { moveInOrder, occupationSchema, occupationSlug } from "./occupation"

describe("occupationSlug", () => {
  it("dérive un identifiant d'URL de l'intitulé", () => {
    expect(occupationSlug("Chef / cheffe de rang")).toBe("chef-cheffe-de-rang")
    expect(occupationSlug("Maître-nageur sauveteur (MNS)")).toBe(
      "maitre-nageur-sauveteur-mns",
    )
    expect(occupationSlug("  Œnologue  ")).toBe("oenologue")
    expect(occupationSlug("Pâtissier / pâtissière")).toBe(
      "patissier-patissiere",
    )
  })

  it("reste vide sans lettre ni chiffre, et court", () => {
    expect(occupationSlug("—")).toBe("")
    expect(occupationSlug("a".repeat(120))).toHaveLength(80)
    expect(occupationSlug(`${"a".repeat(79)} b`)).toBe("a".repeat(79))
  })
})

describe("occupationSchema", () => {
  it("exige un intitulé et une famille", () => {
    expect(
      occupationSchema.parse({ label: " Skiman ", family: " Commerce " }),
    ).toEqual({ label: "Skiman", family: "Commerce" })
    expect(occupationSchema.safeParse({ label: "", family: "" }).success).toBe(
      false,
    )
    expect(
      occupationSchema.safeParse({ label: "…", family: "Cuisine" }).success,
    ).toBe(false)
  })
})

describe("moveInOrder", () => {
  const ids = ["a", "b", "c"]

  it("échange un métier avec son voisin", () => {
    expect(moveInOrder(ids, "b", "up")).toEqual(["b", "a", "c"])
    expect(moveInOrder(ids, "b", "down")).toEqual(["a", "c", "b"])
  })

  it("ne bouge ni le premier vers le haut, ni le dernier vers le bas", () => {
    expect(moveInOrder(ids, "a", "up")).toEqual(ids)
    expect(moveInOrder(ids, "c", "down")).toEqual(ids)
    expect(moveInOrder(ids, "z", "up")).toEqual(ids)
  })
})
