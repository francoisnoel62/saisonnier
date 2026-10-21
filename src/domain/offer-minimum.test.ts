import { describe, expect, it } from "vitest"

import {
  checkPublicationMinimum,
  type MinimumRequirement,
  type PublicationInput,
} from "./offer-minimum"

const blockedDomains = [
  "indeed.com",
  "indeed.fr",
  "indeedemail.com",
  "linkedin.com",
]
const deposited = { origin: "deposited", blockedDomains } as const
const collected = { origin: "collected", blockedDomains } as const

// Annonce déposée minimale : tout le reste est facultatif (§3).
const minimal: PublicationInput = {
  companyId: "0b0c8f7e-5d8e-4c53-9f0e-2f2b3b6f7a10",
  seasonalContractConfirmed: true,
  season: "winter",
  communeName: "Tignes",
  departmentCode: "73",
  durationValue: 5,
  durationUnit: "months",
  applyPhone: "04 65 71 20 10",
}

const missingOf = (
  input: PublicationInput,
  context: typeof deposited | typeof collected = deposited,
) =>
  checkPublicationMinimum(input, context).missing.map(
    (item) => item.requirement,
  )

describe("checkPublicationMinimum", () => {
  it("publie une annonce qui ne contient que le minimum", () => {
    expect(checkPublicationMinimum(minimal, deposited)).toEqual({
      ok: true,
      missing: [],
    })
  })

  it("liste tout ce qui manque à une annonce vide, en français", () => {
    expect(checkPublicationMinimum({}, deposited)).toEqual({
      ok: false,
      missing: [
        { requirement: "company", label: "Une entreprise identifiable" },
        {
          requirement: "seasonal_contract",
          label:
            "Un contrat explicitement saisonnier : saison indiquée et case « contrat saisonnier » cochée",
        },
        {
          requirement: "location",
          label: "Un lieu précis : commune et département",
        },
        {
          requirement: "period",
          label: "Une période (dates de début et de fin) ou une durée",
        },
        {
          requirement: "application",
          label: "Un moyen de candidature direct : email ou téléphone",
        },
      ],
    })
  })

  it.each<[string, PublicationInput, MinimumRequirement]>([
    ["sans entreprise", { companyId: null }, "company"],
    [
      "saison sans confirmation",
      { seasonalContractConfirmed: false },
      "seasonal_contract",
    ],
    ["confirmation sans saison", { season: null }, "seasonal_contract"],
    ["commune faite d'espaces", { communeName: "  " }, "location"],
    ["sans département", { departmentCode: null }, "location"],
    ["durée sans unité", { durationUnit: null }, "period"],
    ["durée nulle", { durationValue: 0 }, "period"],
    ["téléphone fait d'espaces", { applyPhone: " " }, "application"],
  ])("%s : %s manquant", (_case, change, requirement) => {
    expect(missingOf({ ...minimal, ...change })).toEqual([requirement])
  })

  describe("période ou durée", () => {
    const withoutDuration = {
      ...minimal,
      durationValue: null,
      durationUnit: null,
    }

    it("accepte des dates de début et de fin", () => {
      expect(
        missingOf({
          ...withoutDuration,
          startDate: "2026-12-01",
          endDate: "2027-04-15",
        }),
      ).toEqual([])
    })

    it("refuse une date de début seule", () => {
      expect(
        missingOf({ ...withoutDuration, startDate: "2026-12-01" }),
      ).toEqual(["period"])
    })

    it("accepte une date de début avec une durée", () => {
      expect(missingOf({ ...minimal, startDate: "2026-12-01" })).toEqual([])
    })
  })

  describe("moyen de candidature", () => {
    const noMeans = { ...minimal, applyPhone: null }

    it("une annonce déposée exige un email ou un téléphone (H9)", () => {
      expect(missingOf({ ...noMeans, applyEmail: "rh@monhotel.fr" })).toEqual(
        [],
      )
      expect(
        missingOf({ ...noMeans, applyUrl: "https://www.monhotel.fr/emplois" }),
      ).toEqual(["application"])
    })

    it("une annonce collectée peut renvoyer au lien officiel", () => {
      expect(
        missingOf(
          { ...noMeans, applyUrl: "https://www.monhotel.fr/emplois" },
          collected,
        ),
      ).toEqual([])
      expect(
        checkPublicationMinimum(noMeans, collected).missing.map(
          (item) => item.label,
        ),
      ).toEqual(["Un moyen de candidature : email, téléphone ou lien officiel"])
    })

    it("le canal chargé de recrutement exige son nom", () => {
      const recruiter = {
        ...minimal,
        applicationChannel: "recruiter",
      } as const
      expect(missingOf(recruiter)).toEqual(["recruiter"])
      expect(
        missingOf({ ...recruiter, recruiterName: "Camille Rivière" }),
      ).toEqual([])
    })
  })

  describe("domaines exclus", () => {
    it("refuse un email @indeedemail.com, même avec un téléphone", () => {
      expect(
        checkPublicationMinimum(
          { ...minimal, applyEmail: "x@indeedemail.com" },
          deposited,
        ),
      ).toEqual({
        ok: false,
        missing: [
          {
            requirement: "blocked_domain",
            label:
              "Les adresses @indeedemail.com ne sont pas acceptées : indiquez un contact direct de l'entreprise.",
          },
        ],
      })
    })

    it("refuse un lien vers indeed.fr, qui ne compte pas comme moyen de candidature", () => {
      const result = checkPublicationMinimum(
        {
          ...minimal,
          applyPhone: null,
          applyUrl: "https://www.indeed.fr/emplois?jk=1",
        },
        collected,
      )
      expect(result.ok).toBe(false)
      expect(result.missing.map((item) => item.label)).toEqual([
        "Un moyen de candidature : email, téléphone ou lien officiel",
        "Les liens vers indeed.fr ne sont pas acceptés : indiquez un contact direct de l'entreprise.",
      ])
    })

    it("refuse une source qui est un job-board", () => {
      expect(
        checkPublicationMinimum(
          { ...minimal, sourceUrl: "https://fr.linkedin.com/jobs/view/1" },
          collected,
        ).missing,
      ).toEqual([
        {
          requirement: "blocked_domain",
          label:
            "La source linkedin.com n'est pas acceptée : seuls les sites et portails officiels des employeurs le sont.",
        },
      ])
    })
  })
})
