import { describe, expect, it } from "vitest"
import { z } from "zod"

import { hostOf } from "@/domain/blocked-domains"
import { expiryReason, isActive } from "@/domain/offer-activity"
import { checkPublicationMinimum } from "@/domain/offer-minimum"
import { displayedSalary, salaryStatements } from "@/domain/salary"
import { triStates } from "@/domain/tri-state"

import { demoCompanies, demoOffers } from "./demo-data"

const today = "2026-10-21"
const offers = demoOffers(today)
const active = offers.filter((offer) => isActive(offer, today))

describe("demoOffers", () => {
  it("contient 8 entreprises et 40 offres, aux identifiants uniques et valides", () => {
    expect(demoCompanies).toHaveLength(8)
    expect(offers).toHaveLength(40)

    const ids = [...demoCompanies, ...offers].map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Mêmes règles que les identifiants reçus dans les URL (z.uuid(), plan 06).
    expect(ids.every((id) => z.uuid().safeParse(id).success)).toBe(true)
    const companyIds = new Set(demoCompanies.map((company) => company.id))
    expect(offers.every((offer) => companyIds.has(offer.companyId))).toBe(true)
  })

  it("est reproductible et suit la date du jour", () => {
    expect(demoOffers(today)).toEqual(offers)

    const later = demoOffers("2026-10-31")
    expect(later.map((offer) => offer.id)).toEqual(
      offers.map((offer) => offer.id),
    )
    expect(later[0].startDate).toBe("2026-12-10")
    expect(offers[0].startDate).toBe("2026-11-30")
  })

  it("couvre l'été et l'hiver, les annonces déposées et collectées", () => {
    expect(new Set(offers.map((offer) => offer.season))).toEqual(
      new Set(["summer", "winter"]),
    )
    expect(new Set(active.map((offer) => offer.origin))).toEqual(
      new Set(["deposited", "collected"]),
    )
  })

  it("couvre les salaires nets et bruts, mensuels et horaires, et les offres sans salaire", () => {
    const kinds = new Set(
      active.flatMap((offer) =>
        salaryStatements(offer).map((s) => `${s.basis}/${s.unit}`),
      ),
    )
    for (const kind of ["net/month", "gross/month", "gross/hour", "net/hour"]) {
      expect(kinds).toContain(kind)
    }
    expect(active.some((offer) => displayedSalary(offer) === null)).toBe(true)
    // Une fourchette brute horaire, et un net horaire accompagné d'un brut mensuel.
    expect(
      active.some(
        (offer) =>
          offer.salaryGrossUnit === "hour" && offer.salaryGrossMaxCents != null,
      ),
    ).toBe(true)
    expect(
      active.some(
        (offer) =>
          offer.salaryNetUnit === "hour" && offer.salaryGrossUnit === "month",
      ),
    ).toBe(true)
  })

  it("garde beaucoup de valeurs « non précisé », sur chaque critère", () => {
    const fields = [
      "housing",
      "meals",
      "experienceRequired",
      "languagesRequired",
      "drivingLicenseRequired",
      "couplesWelcome",
      "petsAllowed",
    ] as const
    for (const field of fields) {
      // Une valeur absente du jeu est « non précisé », la valeur par défaut en base.
      const values = new Set(active.map((offer) => offer[field] ?? "unknown"))
      expect(values, field).toEqual(new Set(triStates))
    }
    expect(new Set(active.map((offer) => offer.workTime ?? "unknown"))).toEqual(
      new Set(["full_time", "part_time", "unknown"]),
    )
  })

  it("contient des offres à durée seule, sans métier ou confiées au chargé de recrutement", () => {
    expect(
      active.some(
        (offer) => !offer.startDate && !offer.endDate && offer.durationValue,
      ),
    ).toBe(true)
    expect(active.some((offer) => offer.occupationSlug === null)).toBe(true)
    expect(
      active.filter((offer) => offer.applicationChannel === "recruiter"),
    ).toHaveLength(2)
    expect(active.some((offer) => offer.hideCompanyIdentity)).toBe(true)
  })

  it("contient des échéances dépassées et des débuts passés avec une fin à venir", () => {
    const published = offers.filter((offer) => offer.status === "published")
    expect(
      published.filter((offer) => expiryReason(offer, today) === "deadline"),
    ).toHaveLength(2)
    expect(
      published.filter((offer) => expiryReason(offer, today) === "end_date"),
    ).toHaveLength(1)
    expect(
      active.filter((offer) => offer.startDate && offer.startDate < today),
    ).toHaveLength(2)
    // Bornes : date limite et fin de contrat le jour même.
    expect(active.some((offer) => offer.applicationDeadline === today)).toBe(
      true,
    )
    expect(active.some((offer) => offer.endDate === today)).toBe(true)
  })

  it("contient chaque statut, et seules des offres publiées sont actives", () => {
    expect(new Set(offers.map((offer) => offer.status))).toEqual(
      new Set([
        "pending_review",
        "published",
        "unpublished",
        "expired",
        "rejected",
      ]),
    )
    expect(active).toHaveLength(33)
  })

  it("couvre des régions variées", () => {
    const departments = new Set(offers.map((offer) => offer.departmentCode))
    for (const code of [
      "73",
      "74",
      "05",
      "65",
      "66",
      "83",
      "06",
      "33",
      "17",
      "2A",
      "2B",
      "29",
      "974",
    ]) {
      expect(departments).toContain(code)
    }
  })

  it("satisfait le minimum de publication", () => {
    for (const offer of offers) {
      const result = checkPublicationMinimum(
        { ...offer, seasonalContractConfirmed: true },
        { origin: offer.origin, blockedDomains: [] },
      )
      expect(result.missing, offer.id).toEqual([])
    }
  })

  it("ne contient que des contacts fictifs", () => {
    const hosts = offers.flatMap((offer) =>
      [offer.applyEmail, offer.applyUrl, offer.sourceUrl].flatMap((value) =>
        value ? [hostOf(value)] : [],
      ),
    )
    hosts.push(...demoCompanies.map((company) => hostOf(company.website ?? "")))
    expect(hosts.every((host) => host?.endsWith(".example"))).toBe(true)

    // Tranches de numéros réservées aux œuvres de fiction.
    const fiction =
      /^0(1 99 00|2 61 91|3 53 01|4 65 71|5 36 49|6 39 98) \d\d \d\d$/
    const phones = offers.flatMap((offer) => offer.applyPhone ?? [])
    expect(phones.length).toBeGreaterThan(0)
    expect(phones.every((phone) => fiction.test(phone))).toBe(true)
  })
})
