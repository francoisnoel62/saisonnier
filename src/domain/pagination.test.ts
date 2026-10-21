import { describe, expect, it } from "vitest"

import { pageLinks } from "./pagination"

describe("pageLinks", () => {
  it("montre toutes les pages quand elles sont peu nombreuses", () => {
    expect(pageLinks(1, 1)).toEqual([1])
    expect(pageLinks(1, 3)).toEqual([1, 2, 3])
    expect(pageLinks(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("remplace les pages éloignées par un saut", () => {
    expect(pageLinks(1, 10)).toEqual([1, 2, "gap", 10])
    expect(pageLinks(6, 10)).toEqual([1, "gap", 5, 6, 7, "gap", 10])
    expect(pageLinks(10, 10)).toEqual([1, "gap", 9, 10])
  })

  it("montre une page isolée plutôt qu'un saut", () => {
    expect(pageLinks(4, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10])
  })

  it("ignore une page hors limites", () => {
    expect(pageLinks(12, 3)).toEqual([1, 2, 3])
  })
})
