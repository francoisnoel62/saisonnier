import { describe, expect, it } from "vitest"

import { findBlockedTargets, hostOf, isBlockedHost } from "./blocked-domains"

// Extrait des domaines exclus initiaux (drizzle/0001_referentiels.sql).
const blocked = ["indeed.com", "indeed.fr", "indeedemail.com", "linkedin.com"]

describe("hostOf", () => {
  it.each([
    ["https://www.Indeed.fr/viewjob?jk=1", "indeed.fr"],
    ["https://fr.indeed.com/emplois", "fr.indeed.com"],
    ["fr.indeed.com/emplois", "fr.indeed.com"],
    ["www.monhotel.fr", "monhotel.fr"],
    ["//indeed.com/emplois", "indeed.com"],
    ["http://indeed.com:8080/x", "indeed.com"],
    ["https://indeed.com./x", "indeed.com"],
    ["  https://monhotel.fr/recrutement  ", "monhotel.fr"],
    ["x@indeedemail.com", "indeedemail.com"],
    ["X@IndeedEmail.COM", "indeedemail.com"],
    ["mailto:x@indeedemail.com?subject=Candidature", "indeedemail.com"],
    ["recrutement@www.monhotel.fr", "monhotel.fr"],
  ])("%j → %s", (value, host) => {
    expect(hostOf(value)).toBe(host)
  })

  it("lit l'hôte comme un navigateur", () => {
    // Un navigateur suit ces liens jusqu'à indeed.com : ils doivent être reconnus.
    expect(hostOf("http:/indeed.com")).toBe("indeed.com")
    expect(hostOf("https:indeed.com")).toBe("indeed.com")
    expect(hostOf("https://%69ndeed.com")).toBe("indeed.com")
    expect(hostOf("https://ｉｎｄｅｅｄ．ｃｏｍ")).toBe("indeed.com")
    expect(hostOf("https://monhotel.fr@indeed.com/")).toBe("indeed.com")
  })

  it("ne prend pas un email cité dans une URL pour l'hôte", () => {
    expect(hostOf("indeed.com/emplois?contact=rh@monhotel.fr")).toBe(
      "indeed.com",
    )
  })

  it.each([
    "",
    "   ",
    "pas un email",
    "javascript:alert(1)",
    "tel:+33465710000",
  ])("renvoie null pour %j", (value) => {
    expect(hostOf(value)).toBeNull()
  })
})

describe("isBlockedHost", () => {
  it("détecte le domaine exact et ses sous-domaines", () => {
    expect(isBlockedHost("indeed.com", blocked)).toBe(true)
    expect(isBlockedHost("fr.indeed.com", blocked)).toBe(true)
    expect(isBlockedHost("emplois.fr.indeed.com", blocked)).toBe(true)
  })

  it("notindeed.com n'est pas bloqué", () => {
    expect(isBlockedHost("notindeed.com", blocked)).toBe(false)
    expect(isBlockedHost("indeed.com.monhotel.fr", blocked)).toBe(false)
    expect(isBlockedHost("monhotel.fr", blocked)).toBe(false)
  })

  it("normalise l'hôte et la liste", () => {
    expect(isBlockedHost("WWW.Indeed.FR.", blocked)).toBe(true)
    expect(isBlockedHost("fr.indeed.com", ["Indeed.com"])).toBe(true)
  })

  it("ne bloque rien avec une liste vide ou une entrée vide", () => {
    expect(isBlockedHost("indeed.com", [])).toBe(false)
    expect(isBlockedHost("indeed.com", [""])).toBe(false)
  })
})

describe("findBlockedTargets", () => {
  it("fr.indeed.com et x@indeedemail.com sont bloqués", () => {
    expect(
      findBlockedTargets(
        {
          applyUrl: "https://fr.indeed.com/viewjob?jk=1",
          applyEmail: "x@indeedemail.com",
        },
        blocked,
      ),
    ).toEqual([
      { field: "applyUrl", host: "fr.indeed.com", domain: "indeed.com" },
      {
        field: "applyEmail",
        host: "indeedemail.com",
        domain: "indeedemail.com",
      },
    ])
  })

  it("contrôle aussi la source d'une annonce collectée", () => {
    expect(
      findBlockedTargets(
        { sourceUrl: "https://www.linkedin.com/jobs/view/1" },
        blocked,
      ),
    ).toEqual([
      { field: "sourceUrl", host: "linkedin.com", domain: "linkedin.com" },
    ])
  })

  it("laisse passer les contacts directs de l'entreprise", () => {
    expect(
      findBlockedTargets(
        {
          applyUrl: "https://notindeed.com/recrutement",
          applyEmail: "rh@monhotel.fr",
          sourceUrl: "https://www.monhotel.fr/emplois",
        },
        blocked,
      ),
    ).toEqual([])
  })

  it("ignore les champs vides", () => {
    expect(
      findBlockedTargets({ applyUrl: null, applyEmail: "" }, blocked),
    ).toEqual([])
    expect(findBlockedTargets({}, blocked)).toEqual([])
  })
})
