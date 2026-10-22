import { afterEach, describe, expect, it, vi } from "vitest"

import { searchCompanyDirectory } from "./directory"

// Extrait d'une vraie réponse de l'API (octobre 2026), réduit aux champs lus.
const establishment = {
  siret: "84419065200025",
  activite_principale: "55.10Z",
  libelle_commune: "ANNECY",
  adresse: "17 B RUE VAUGELAS 74000 ANNECY",
  nom_commercial: "ATIPIK HOTEL",
  liste_enseignes: ["HOTEL ALEXANDRA"],
}
const response = {
  results: [
    {
      siren: "844190652",
      nom_complet: "LES PORTES DU LAC (ATIPIK HOTEL)",
      nom_raison_sociale: "LES PORTES DU LAC",
      activite_principale: "55.10Z",
      siege: establishment,
      matching_etablissements: [
        {
          ...establishment,
          siret: "84419065200017",
          libelle_commune: "SEVRIER",
        },
      ],
    },
  ],
  total_results: 1,
}

function mockFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("searchCompanyDirectory", () => {
  it("pré-remplit raison sociale, SIREN, SIRET, activité et commune du siège", async () => {
    const fetchMock = mockFetch(async () => Response.json(response))
    expect(await searchCompanyDirectory("portes du lac")).toEqual({
      ok: true,
      results: [
        {
          legalName: "LES PORTES DU LAC",
          displayName: "HOTEL ALEXANDRA",
          siren: "844190652",
          siret: "84419065200025",
          nafCode: "55.10Z",
          nafLabel: "Hôtels et hébergement similaire",
          communeName: "ANNECY",
          address: "17 B RUE VAUGELAS 74000 ANNECY",
        },
      ],
    })
    const url = new URL(String(fetchMock.mock.calls[0]))
    expect(url.searchParams.get("q")).toBe("portes du lac")
    expect(url.searchParams.get("etat_administratif")).toBe("A")
  })

  it("retient l'établissement d'un SIRET saisi avec des espaces", async () => {
    const fetchMock = mockFetch(async () => Response.json(response))
    const result = await searchCompanyDirectory("844 190 652 00017")
    expect(result.ok && result.results[0]).toMatchObject({
      siret: "84419065200017",
      communeName: "SEVRIER",
    })
    expect(new URL(String(fetchMock.mock.calls[0])).searchParams.get("q")).toBe(
      "84419065200017",
    )
  })

  it("n'appelle pas l'API pour moins de 3 caractères", async () => {
    const fetchMock = mockFetch(async () => Response.json(response))
    expect(await searchCompanyDirectory(" ab ")).toEqual({
      ok: true,
      results: [],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("signale l'indisponibilité : erreur HTTP, réponse inattendue, délai dépassé", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    mockFetch(async () => new Response("", { status: 503 }))
    expect(await searchCompanyDirectory("hotel")).toEqual({ ok: false })
    mockFetch(async () => Response.json({ resultats: [] }))
    expect(await searchCompanyDirectory("hotel")).toEqual({ ok: false })
    mockFetch(async () => {
      throw new DOMException("délai dépassé", "TimeoutError")
    })
    expect(await searchCompanyDirectory("hotel")).toEqual({ ok: false })
  })
})
