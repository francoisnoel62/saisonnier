import { describe, expect, it } from "vitest"

import {
  capturedId,
  compileUrlPattern,
  parseUrlPattern,
  suggestUrlPattern,
} from "./url-pattern"

describe("compilation des motifs simplifiés (§9)", () => {
  it.each([
    [
      "https://recrute.exemple.fr/offres/{slug}-{id}",
      "^https://recrute\\.exemple\\.fr/offres/[^/?#]+-([0-9]+)/?$",
    ],
    [
      "https://www.exemple.fr/emploi/{code}",
      "^https://www\\.exemple\\.fr/emploi/([A-Za-z0-9]+)/?$",
    ],
    [
      "https://jobs.exemple.fr/offre.php?id={id}",
      "^https://jobs\\.exemple\\.fr/offre\\.php\\?id=([0-9]+)$",
    ],
  ])("%s → %s", (pattern, expected) => {
    expect(compileUrlPattern(pattern)).toBe(expected)
  })

  it("l'expression ancrée n'accepte que les fiches du site", () => {
    const expression = new RegExp(
      compileUrlPattern("https://recrute.exemple.fr/offres/{slug}-{id}")!,
    )
    expect(
      expression.test("https://recrute.exemple.fr/offres/serveur-12"),
    ).toBe(true)
    expect(expression.test("https://recrute.exemple.fr/offres/serveur")).toBe(
      false,
    )
    expect(
      expression.test("https://recrute.exemple.fr/offres/serveur-12/postuler"),
    ).toBe(false)
    expect(
      expression.test(
        "https://evil.example/?u=https://recrute.exemple.fr/offres/a-1",
      ),
    ).toBe(false)
    expect(
      capturedId(
        compileUrlPattern("https://recrute.exemple.fr/offres/{slug}-{id}")!,
        "https://recrute.exemple.fr/offres/chef-de-rang-42",
      ),
    ).toBe("42")
  })

  it.each([
    ["http://recrute.exemple.fr/{id}", "https"],
    ["https://*.exemple.fr/{id}", "joker"],
    ["https://recrute.exemple.fr:8443/{id}", "port"],
    ["https://user@recrute.exemple.fr/{id}", "hôte"],
    ["https://Recrute.exemple.fr/{id}", "minuscules"],
    ["https://recrute.exemple.fr/{id}/{code}", "Une seule capture"],
    ["https://recrute.exemple.fr/{slug}{id}", "ne se suivent jamais"],
    ["https://recrute.exemple.fr/{slug}-x-{slug}", "Un seul {slug}"],
    ["https://recrute.exemple.fr/{regex}", "Jeton inconnu"],
    ["https://recrute.exemple.fr/(\\d+)", ""],
    [
      "https://recrute.exemple.fr/a/{*}/b/{*}/c/{*}/d/{*}/e/{*}/f/{*}/g/{*}/h/{*}/i/{id}",
      "jetons au plus",
    ],
    ["https://recrute.exemple.fr/#/{id}", "littérale"],
    ["https://recrute.exemple.fr/offre?id={slug}", "{id} ou {code}"],
  ])("refuse %s", (pattern, reason) => {
    const result = parseUrlPattern(pattern)
    if (pattern.includes("(\\d+)")) {
      // Les parenthèses sont des littéraux échappés, jamais une expression.
      expect(compileUrlPattern(pattern)).toBe(
        "^https://recrute\\.exemple\\.fr/\\(\\\\d\\+\\)/?$",
      )
      return
    }
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain(reason)
  })

  it("moins de 5 ms par URL hostile de 2 048 caractères", () => {
    const patterns = [
      "https://recrute.exemple.fr/offres/{slug}-{id}",
      "https://recrute.exemple.fr/{*}/{slug}-{id}/{code}-fin",
      "https://recrute.exemple.fr/offres/{id}-{slug}?ref=site",
    ].map((pattern) => new RegExp(compileUrlPattern(pattern)!))
    const hostile = [
      `https://recrute.exemple.fr/offres/${"a-1".repeat(680)}x`,
      `https://recrute.exemple.fr/${"-".repeat(2000)}`,
      `https://recrute.exemple.fr/x/${"1-".repeat(1000)}/z`,
    ]
    for (const expression of patterns)
      for (const url of hostile) {
        const start = performance.now()
        expression.test(url.slice(0, 2048))
        expect(performance.now() - start).toBeLessThan(5)
      }
  })
})

describe("suggestion de motif", () => {
  it("retrouve les motifs des portails migrés", () => {
    expect(
      suggestUrlPattern([
        "https://recrute.belambra.fr/jobs/8588693-second-de-cuisine-h-f",
        "https://recrute.belambra.fr/jobs/8585963-responsable-restauration-h-f",
        "https://recrute.belambra.fr/jobs/8584535-chef-de-cuisine-h-f",
        "https://recrute.belambra.fr/connect",
      ]),
    ).toMatchObject({
      pattern: "https://recrute.belambra.fr/jobs/{id}-{slug}",
      matched: 3,
    })
    expect(
      suggestUrlPattern([
        "https://vvfrecrute.factorial.fr/job_posting/assistant-e-commercial-grands-comptes-h-f-327834",
        "https://vvfrecrute.factorial.fr/job_posting/responsable-de-maintenance-h-f-326869",
        "https://vvfrecrute.factorial.fr/job_posting/serveur-h-f-326962",
      ])?.pattern,
    ).toBe("https://vvfrecrute.factorial.fr/job_posting/{slug}-{id}")
    expect(
      suggestUrlPattern([
        "https://candidat.francetravail.fr/offres/recherche/detail/215PYPJ",
        "https://candidat.francetravail.fr/offres/recherche/detail/215PYFY",
        "https://candidat.francetravail.fr/offres/recherche/detail/215NXXQ",
      ])?.pattern,
    ).toBe("https://candidat.francetravail.fr/offres/recherche/detail/{code}")
  })
  it("ne propose rien sous trois liens réguliers", () => {
    expect(
      suggestUrlPattern([
        "https://hotel.exemple.fr/offres/1",
        "https://hotel.exemple.fr/contact",
      ]),
    ).toBeNull()
  })
})
