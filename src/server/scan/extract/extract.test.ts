import { expect, it, vi } from "vitest"

import { parseLenientJson, jobPostings } from "./jsonld"
import { load, usefulText } from "./html"
import { extractContacts } from "./contacts"
import { splitPostingBlocks } from "./multi"
import { posting } from "@/domain/scan/rules-fixtures"
import { extractApplication } from "@/domain/scan/application"
import { valueOf } from "@/domain/scan/field"
import {
  context,
  success,
  testDefinitions,
} from "../sources/adapter-test-fixtures"
import { resolvePlace } from "../places"

it("JSON lenient : répare les contrôles bruts dans les chaînes, conserve les guillemets échappés et rejette une structure invalide", () => {
  expect(
    parseLenientJson('{"title":"Ligne\navec\tcontrôle et \\"citation\\""}'),
  ).toEqual({ title: 'Ligne\navec\tcontrôle et "citation"' })
  expect(() => parseLenientJson('{"title":\u0001"invalide"}')).toThrow()
  expect(
    jobPostings(
      load(
        '<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Serveur"}]}</script>',
      ),
    ),
  ).toMatchObject([{ title: "Serveur" }])
})

it("HTML : blocs séparés, éléments de site retirés et texte borné", () => {
  const $ = load(
    "<nav>Navigation</nav><main><h1>Poste</h1><p>Une phrase.</p><p>Deuxième phrase.</p><script>alert(1)</script><form>Formulaire</form></main><footer>Contact de site</footer>",
  )
  expect(usefulText($)).toBe("Poste\nUne phrase.\nDeuxième phrase.")
  expect(usefulText(load(`<p>${"x".repeat(21000)}</p>`))).toHaveLength(20000)
})

it("contacts : recrutement, accueil et coordonnées de site restent distincts, rien n'est deviné", () => {
  const contacts = extractContacts(
    [
      {
        heading: "Candidature",
        text: "Envoyez votre CV à rh@hotel.example ou au 01 99 00 00 01",
        scope: "posting",
      },
      {
        heading: "Contact",
        text: "Accueil : accueil@hotel.example\nAdresse masquée : rh [at] hotel.example",
        scope: "posting",
      },
      { heading: "Candidature", text: "groupe@hotel.example", scope: "site" },
    ],
    "https://hotel.example/job",
  )
  const application = valueOf(extractApplication({ contacts }))!
  expect(application.emails).toEqual(["rh@hotel.example"])
  expect(application.phones).toEqual(["01 99 00 00 01"])
  expect(application.generalContacts.map((contact) => contact.value)).toEqual([
    "accueil@hotel.example",
    "groupe@hotel.example",
  ])
})

it("postes multiples : seules les associations explicites deviennent des dossiers séparés avec leur index", () => {
  const base = posting()
  const explicit = splitPostingBlocks(
    load(
      "<table><tr><th>Poste</th><th>Lieu</th><th>Période</th></tr><tr><td>Serveur</td><td>Chamonix</td><td>du 1 décembre 2026 au 1 mars 2027</td></tr><tr><td>Cuisinier</td><td>Lacanau</td><td>du 1 juin 2027 au 1 septembre 2027</td></tr></table>",
    ),
    base,
    "fixture@1",
  )
  expect(explicit).toMatchObject([
    { title: "Serveur", index: 0, associationsExplicit: true },
    { title: "Cuisinier", index: 1, associationsExplicit: true },
  ])
  const ambiguous = splitPostingBlocks(
    load("<h2>Plusieurs postes</h2>"),
    {
      ...base,
      usefulText:
        "Plusieurs postes : cuisine et service, à Chamonix et à Lacanau",
    },
    "fixture@1",
  )
  expect(ambiguous).toHaveLength(1)
  expect(ambiguous[0]).toMatchObject({
    multiplePositions: true,
    associationsExplicit: false,
  })
  const samePost = splitPostingBlocks(
    load(
      "<table><tr><th>Poste</th><th>Lieu</th><th>Période</th></tr><tr><td>Serveur</td><td>Chamonix</td><td>du 1 décembre 2026 au 1 mars 2027</td></tr><tr><td>Serveur H/F</td><td>Lacanau</td><td>du 1 décembre 2026 au 1 mars 2027</td></tr></table>",
    ),
    base,
    "fixture@1",
  )
  expect(samePost).toHaveLength(1)
  expect(samePost[0]).toMatchObject({
    multiplePositions: false,
    associationsExplicit: true,
    observations: expect.arrayContaining([
      expect.objectContaining({
        field: "locationCandidates",
        value: [{ communeName: "Chamonix" }, { communeName: "Lacanau" }],
      }),
    ]),
  })
})

it("lieux : alias prioritaire, résultat geo unique et cache du passage ; plusieurs communes restent à vérifier", async () => {
  const ctx = context(testDefinitions.vvf)
  expect(
    await resolvePlace({ name: "PRAPOUTEL LES SEPT LAUX" }, ctx),
  ).toMatchObject({ status: "established", value: [{ inseeCode: "38002" }] })
  expect(ctx.scanFetch).not.toHaveBeenCalled()
  const raw = {
    communeName: "Chamonix",
    postalCode: "74400",
    country: "France",
  }
  expect(await resolvePlace(raw, ctx)).toMatchObject({ status: "established" })
  await resolvePlace(raw, ctx)
  expect(ctx.scanFetch).toHaveBeenCalledTimes(1)
  vi.mocked(ctx.scanFetch).mockResolvedValue(
    success(
      JSON.stringify([
        {
          nom: "Commune A",
          code: "33001",
          codesPostaux: ["33000"],
          codeDepartement: "33",
        },
        {
          nom: "Commune B",
          code: "33002",
          codesPostaux: ["33000"],
          codeDepartement: "33",
        },
      ]),
      "https://geo.api.gouv.fr",
      "application/json",
    ),
  )
  expect(
    await resolvePlace({ communeName: "Commune", postalCode: "33000" }, ctx),
  ).toMatchObject({
    status: "to_verify",
    value: [{ communeName: "Commune A" }, { communeName: "Commune B" }],
  })
})
