import { expect, it } from "vitest"

import {
  franceTravailListUrl,
  franceTravailSearchUrl,
  franceTravailPostingDataUrl,
} from "./france-travail"

it("conserve exactement la recherche France Travail du fondateur", () => {
  expect(franceTravailListUrl()).toBe(franceTravailSearchUrl)
  expect(
    Object.fromEntries(new URL(franceTravailSearchUrl).searchParams),
  ).toEqual({
    domaine: "G",
    emission: "3",
    lieux: "99100",
    offresPartenaires: "false",
    range: "0-19",
    rayon: "10",
    tri: "1",
    typeContrat: "SAI",
  })
})
it("change uniquement la plage lors d'une pagination bornée", () => {
  const first = new URL(franceTravailListUrl())
  const second = new URL(franceTravailListUrl(1))
  expect(second.searchParams.get("range")).toBe("20-39")
  first.searchParams.delete("range")
  second.searchParams.delete("range")
  expect(second.href).toBe(first.href)
})
it.each([-1, 0.5, 20, Number.NaN])(
  "refuse une page hors limites : %s",
  (page) => {
    expect(() => franceTravailListUrl(page)).toThrow("hors limites")
  },
)

it("lit le JSON public d'une fiche sans perdre son URL de découverte", () => {
  expect(
    franceTravailPostingDataUrl(
      "https://candidat.francetravail.fr/offres/recherche/detail/215PYPJ",
    ),
  ).toBe("https://candidat.francetravail.fr/api-descriptifoffre/offre/215PYPJ")
})
it.each([
  "https://other.example/offres/recherche/detail/215PYPJ",
  "http://candidat.francetravail.fr/offres/recherche/detail/215PYPJ",
  "https://candidat.francetravail.fr/offres/recherche/detail/215PYPJ?secret=value",
  "https://user@candidat.francetravail.fr/offres/recherche/detail/215PYPJ",
  "https://candidat.francetravail.fr/offres/recherche/detail/../admin",
])("ne transforme pas une URL hors du parcours public : %s", (url) => {
  expect(franceTravailPostingDataUrl(url)).toBeNull()
})
