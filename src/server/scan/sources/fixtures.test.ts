import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { load } from "cheerio"
import { expect, it } from "vitest"

const root = join(process.cwd(), "src/server/scan/sources/fixtures")
// Tout nouveau dossier de captures est contrôlé sans avoir à l'inscrire ici.
const sources = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
const trackers =
  "googletagmanager|google-analytics|googleadservices|facebook\\.net|doubleclick|hotjar|clarity\\.ms"

it("les quatre sources du dossier ont leurs captures", () => {
  expect(sources).toEqual(
    expect.arrayContaining([
      "belambra",
      "vvf",
      "ms-vacances",
      "france-travail",
    ]),
  )
})

it.each(sources)(
  "%s : captures réelles, documentées et contacts fictifs uniquement",
  (source) => {
    const directory = join(root, source)
    const files = readdirSync(directory)
    expect(files).toContain("README.md")
    expect(
      files.filter((file) => file.startsWith("posting-")).length,
    ).toBeGreaterThanOrEqual(3)
    expect(
      files.filter((file) => file.startsWith("posting-")).length,
    ).toBeLessThanOrEqual(6)
    for (const file of files.filter((file) =>
      /\.(html|xml|json)$/.test(file),
    )) {
      const body = readFileSync(join(directory, file), "utf8")
      const $ = load(body, { xml: file.endsWith(".xml") })
      expect(
        $(
          "script:not([type='application/ld+json']), img, iframe, svg, meta[name='csrf-token'], input[name='authenticity_token'], input[name='t:formdata']",
        ).length,
        file,
      ).toBe(0)
      // Aucun reste de suivi, même sans exécution (préconnexions, liens).
      expect(
        $("link[href], a[href]")
          .map((_i, el) => $(el).attr("href"))
          .get()
          .filter((href) => new RegExp(trackers).test(href)),
        file,
      ).toEqual([])
      // L'anonymisation ne touche pas aux identifiants ATS : un GUID garde sa forme d'UUID.
      for (const guid of $("guid")
        .map((_i, el) => $(el).text().trim())
        .get())
        expect(guid, `${file}: ${guid}`).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      // Le texte RSS contient lui-même du HTML échappé : le contrôle porte aussi dessus.
      const text = file.endsWith(".json")
        ? JSON.stringify(JSON.parse(body))
        : $.root().text() +
          " " +
          $("[href]")
            .map((_i, el) => $(el).attr("href"))
            .get()
            .join(" ")
      for (const match of text.matchAll(
        /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      )) {
        expect(match[1].endsWith(".example"), `${file}: ${match[0]}`).toBe(true)
      }
      for (const match of text.matchAll(
        /(?<!\d)(?:\+33[ .()-]*|0)[1-9](?:[ .()-]*\d){8}(?!\d)/g,
      )) {
        const normalized = match[0].replace(/\D/g, "").replace(/^33/, "0")
        expect(
          ["019900", "026191", "035301", "046571", "053649", "063998"].some(
            (prefix) => normalized.startsWith(prefix),
          ),
          `${file}: ${match[0]}`,
        ).toBe(true)
      }
    }
  },
)
