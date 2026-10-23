import { describe, expect, it } from "vitest"

import { boundObservations, boundText } from "./observation"
import { extractPeriod } from "./period"
import { evidence, observation } from "./rules-fixtures"
import { extractSeason } from "./season"
import { parseSourceDate, zonedDayRange } from "./source-date"
import { discoveryWindow, windowDecision } from "./window"

describe("§10 — dates de publication et fenêtre de découverte", () => {
  it.each([
    ["2026-10-22T10:14:35+02:00", "2026-10-22T08:14:35.000Z"],
    ["2026-10-22T10:14:35.125Z", "2026-10-22T10:14:35.125Z"],
    ["Thu, 22 Oct 2026 10:14:35 +0200", "2026-10-22T08:14:35.000Z"],
    ["22 Oct 2026 08:14 GMT", "2026-10-22T08:14:00.000Z"],
  ])("un instant conserve le fuseau : %s", (raw, at) =>
    expect(parseSourceDate(raw)).toEqual({ precision: "instant", at }),
  )
  it.each(["2026-10-16", "16 octobre 2026", "16 OCTOBRE 2026"])(
    "une date sans heure reste un jour : %s",
    (raw) =>
      expect(parseSourceDate(raw)).toEqual({
        precision: "day",
        date: "2026-10-16",
        timeZone: "Europe/Paris",
      }),
  )
  it.each([
    "",
    "hier",
    "2026-02-29",
    "31 avril 2026",
    "2026-13-01",
    "2026-10-22T25:00:00Z",
    "2026-02-30T10:00:00Z",
    "31 Feb 2026 10:00:00 GMT",
    "22 Oct 2026 10:61:00 +0200",
    "2026-10-22T10:00:00+25:00",
  ])("une date invalide n'invente rien : %s", (raw) =>
    expect(parseSourceDate(raw)).toBeNull(),
  )
  it("une heure locale est interprétée dans le fuseau source, Paris par défaut", () => {
    expect(parseSourceDate("2026-10-22T10:00:00")).toEqual({
      precision: "instant",
      at: "2026-10-22T08:00:00.000Z",
    })
    expect(parseSourceDate("2026-10-22T10:00:00", { timeZone: "UTC" })).toEqual(
      { precision: "instant", at: "2026-10-22T10:00:00.000Z" },
    )
    expect(
      parseSourceDate("2026-10-22T10:00:00.125", {
        timeZone: "Asia/Kathmandu",
      }),
    ).toEqual({ precision: "instant", at: "2026-10-22T04:15:00.125Z" })
  })
  it.each(["2026-10-25T02:30:00", "2026-03-29T02:30:00"])(
    "une heure locale ambiguë ou inexistante nécessite un décalage : %s",
    (raw) => expect(parseSourceDate(raw)).toBeNull(),
  )
  it("une date bissextile valide est conservée", () =>
    expect(parseSourceDate("29 février 2028")?.precision).toBe("day"))
  it("le fuseau connu de la source est conservé", () =>
    expect(
      parseSourceDate("2026-10-16", { timeZone: "America/Montreal" }),
    ).toEqual({
      precision: "day",
      date: "2026-10-16",
      timeZone: "America/Montreal",
    }))
  it("un fuseau invalide n'est pas accepté", () =>
    expect(parseSourceDate("2026-10-16", { timeZone: "invalide" })).toBeNull())
  const window = discoveryWindow("daily", "2026-10-24T10:00:00Z")
  it.each([
    ["2026-10-21T10:00:00Z", "inside"],
    ["2026-10-21T09:59:59Z", "outside"],
    ["2026-10-24T10:00:00Z", "inside"],
    ["2026-10-24T10:00:01Z", "outside"],
    ["2026-10-21", "inside"],
    ["2026-10-20", "outside"],
    ["2026-10-25", "outside"],
  ])(
    "borne 72 h incluse et jour civil recoupant la fenêtre : %s",
    (raw, result) =>
      expect(windowDecision(parseSourceDate(raw), window)).toBe(result),
  )
  it("reprise après cinq jours : la fenêtre reste de 72 h", () => {
    const resumed = discoveryWindow("daily", "2026-10-29T10:00:00Z")!
    expect(resumed.start).toBe("2026-10-26T10:00:00.000Z")
    expect(Date.parse(resumed.end) - Date.parse(resumed.start)).toBe(
      72 * 3_600_000,
    )
  })
  it("le remplissage initial n'a aucune fenêtre", () => {
    expect(discoveryWindow("bootstrap", "2026-10-24T10:00:00Z")).toBeNull()
    expect(windowDecision(parseSourceDate("2020-01-01"), null)).toBe("inside")
    expect(windowDecision(null, window)).toBe("unknown")
  })
  it.each([
    ["2026-03-29", 23],
    ["2026-10-25", 25],
  ])("un jour à Paris peut durer %s", (date, hours) => {
    const range = zonedDayRange(date, "Europe/Paris")!
    expect(range.end - range.start).toBe(hours * 3_600_000)
    expect(
      windowDecision(parseSourceDate(date), {
        start: new Date(range.end - 1).toISOString(),
        end: new Date(range.end + 10).toISOString(),
      }),
    ).toBe("inside")
    expect(
      windowDecision(parseSourceDate(date), {
        start: new Date(range.end).toISOString(),
        end: new Date(range.end + 10).toISOString(),
      }),
    ).toBe("outside")
  })
  it("le jour est évalué dans le fuseau de la source", () =>
    expect(
      windowDecision(
        parseSourceDate("2026-10-20", { timeZone: "America/New_York" }),
        { start: "2026-10-21T02:00:00Z", end: "2026-10-21T03:00:00Z" },
      ),
    ).toBe("inside"))
})

describe("§10 — périodes : aucune année ou fin de contrat inventée", () => {
  const extract = (text: string, referenceDate = "2026-10-24") =>
    extractPeriod([observation(text)], { referenceDate })
  it.each([
    ["du 1er février au 23 mars 2027", "2027-02-01", "2027-03-23"],
    ["1er février au 23 mars 2027", "2027-02-01", "2027-03-23"],
    ["du 15/12/2026 au 15/04/2027", "2026-12-15", "2027-04-15"],
    ["du 2026-12-15 au 2027-04-15", "2026-12-15", "2027-04-15"],
  ])("dates complètes : %s", (text, startDate, endDate) =>
    expect(extract(text).field).toMatchObject({
      status: "established",
      value: { startDate, endDate },
    }),
  )
  it.each([
    ["4 mois", 4, "months"],
    ["contrat de 5 mois", 5, "months"],
    ["6 semaines", 6, "weeks"],
  ])("durée suffisante : %s", (text, value, unit) =>
    expect(extract(text).field).toMatchObject({
      status: "established",
      value: { duration: { value, unit } },
    }),
  )
  it("une date de début peut accompagner la durée", () =>
    expect(
      extract("Contrat de 4 mois à partir du 20 décembre 2026").field,
    ).toMatchObject({
      status: "established",
      value: {
        startDate: "2026-12-20",
        duration: { value: 4, unit: "months" },
      },
    }))
  it("une durée avec début peut prouver une saison sans inventer de fin publiée", () => {
    const result = extract("Contrat de 4 mois à partir du 20 décembre 2026")
    expect(extractSeason([], result.field).field).toMatchObject({
      status: "established",
      value: "winter",
    })
    expect(result.field).not.toHaveProperty("value.endDate")
  })
  it("une date de début seule reste à vérifier", () =>
    expect(extract("à partir du 20 décembre 2026").field.status).toBe(
      "to_verify",
    ))
  it.each([
    ["2026-10-24", "2026-12-15", "2027-04-15"],
    ["2027-01-01", "2026-12-15", "2027-04-15"],
    ["2027-05-01", "2027-12-15", "2028-04-15"],
  ])(
    "dates sans année : année déduite à vérifier, référence %s",
    (ref, startDate, endDate) => {
      const result = extract("du 15 décembre au 15 avril", ref)
      expect(result.field).toMatchObject({
        status: "to_verify",
        value: { startDate, endDate },
      })
      expect(result.issues.map((issue) => issue.code)).toContain(
        "year_inferred",
      )
    },
  )
  it("un millésime final ne permet pas d'inventer celui de décembre", () => {
    const result = extract("du 15 décembre au 15 avril 2027")
    expect(result.field.status).toBe("to_verify")
    expect(result.field).not.toHaveProperty("value")
  })
  it("mois sans jour : extrait conservé, aucune date proposée", () => {
    const result = extract("de décembre à avril")
    expect(result.field.status).toBe("to_verify")
    expect(result.field).not.toHaveProperty("value")
    expect(result.field.evidence[0].excerpt).toBe("de décembre à avril")
  })
  it.each(["du 31 février au 23 mars 2027", "du 15/04/2027 au 15/12/2026"])(
    "une période invalide ne s'établit pas : %s",
    (text) => expect(extract(text).field.status).toBe("to_verify"),
  )
  it("validThrough est une échéance, jamais une fin de contrat", () =>
    expect(
      extractPeriod([observation("2027-04-15", "validThrough")], {
        referenceDate: "2026-10-24",
      }).field.status,
    ).toBe("absent"))
  it("dates incompatibles avec la durée : bloquant", () =>
    expect(
      extract("du 1er février au 23 mars 2027, contrat de 4 mois").issues,
    ).toContainEqual(
      expect.objectContaining({ code: "period_contradiction", blocking: true }),
    ))
  it("une durée ne tolère pas un jour supplémentaire", () =>
    expect(
      extract("du 15 décembre 2026 au 16 avril 2027, contrat de 4 mois").field
        .status,
    ).toBe("contradictory"))
  it.each([
    "du 15 décembre 2026 au 15 avril 2027, contrat de 4 mois",
    "du 1er février au 28 février 2027, contrat de 1 mois",
    "du 1er février au 14 février 2027, contrat de 2 semaines",
  ])("durée calendaire cohérente : %s", (text) =>
    expect(extract(text).field.status).toBe("established"),
  )
  it("plusieurs périodes différentes restent contradictoires", () =>
    expect(
      extractPeriod(
        [
          observation("du 1er février au 23 mars 2027"),
          observation("du 2 février au 23 mars 2027"),
        ],
        { referenceDate: "2026-10-24" },
      ).field.status,
    ).toBe("contradictory"))
  it("des champs structurés complémentaires s'assemblent", () =>
    expect(
      extractPeriod(
        [
          observation("2026-12-15", "startDate"),
          observation("2027-04-15", "endDate"),
          observation({ value: 4, unit: "months" }, "duration"),
        ],
        { referenceDate: "2026-10-24" },
      ).field.status,
    ).toBe("established"))
  it("les périodes générales du site ne prouvent pas celle du poste", () =>
    expect(
      extractPeriod(
        [observation("du 1er février au 23 mars 2027", "description", "site")],
        { referenceDate: "2026-10-24" },
      ).field.status,
    ).toBe("absent"))
  it("une durée niée ne s'établit pas", () =>
    expect(extract("pas de contrat de 4 mois").field.status).toBe("absent"))
  it.each([
    ["du 1er novembre 2026 au 30 avril 2027", "winter"],
    ["du 1er mai au 31 octobre 2027", "summer"],
  ])(
    "une période entièrement située dans une saison l'établit : %s",
    (text, value) =>
      expect(extractSeason([], extract(text).field).field).toMatchObject({
        status: "established",
        value,
      }),
  )
  it("une période à cheval reste à vérifier", () =>
    expect(
      extractSeason([], extract("du 1er avril au 1er juin 2027").field).field
        .status,
    ).toBe("to_verify"))
  it("mot et dates contradictoires : bloquant", () =>
    expect(
      extractSeason(
        [observation("saison d'hiver")],
        extract("du 1er mai au 31 octobre 2027").field,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: "season_contradiction" })))
  it("une saison ne se déduit pas de dates dont l'année est à vérifier", () =>
    expect(
      extractSeason([], extract("du 15 décembre au 15 avril").field).field
        .status,
    ).toBe("to_verify"))
  it("un mot explicite et une période qui déborde de sa saison se contredisent", () =>
    expect(
      extractSeason(
        [observation("hiver")],
        extract("du 1er décembre 2026 au 1er juin 2027").field,
      ).issues[0].code,
    ).toBe("season_contradiction"))
  it("le verbe été n'est pas une saison", () =>
    expect(
      extractSeason([observation("Le recrutement a été ouvert récemment")], {
        status: "absent",
        evidence: [],
      }).field.status,
    ).toBe("absent"))
  it.each([
    "Une expérience de 4 mois est demandée",
    "Une période d'essai de 2 semaines est prévue",
  ])("une durée étrangère au contrat ne devient pas sa période : %s", (text) =>
    expect(extract(text).field.status).toBe("absent"),
  )
})

describe("SH13 — preuves et texte bornés sans mutation", () => {
  it("20 000 caractères et 200 observations, extraits de 300 caractères", () => {
    const input = Array.from({ length: 201 }, () => ({
      ...observation("x"),
      evidence: { ...evidence, excerpt: "é".repeat(301) },
    }))
    expect(boundText("x".repeat(20_001))).toHaveLength(20_000)
    const output = boundObservations(input)
    expect(output).toHaveLength(200)
    expect(output.every((item) => item.evidence.excerpt.length === 300)).toBe(
      true,
    )
    expect(input[0].evidence.excerpt.length).toBe(301)
    expect(input).toHaveLength(201)
  })
})
