import { describe, expect, it } from "vitest"

import { employerLeadKey, normalizeEmployerName } from "./employer-lead"
import {
  classifyDossier,
  discoveryCoverage,
  formatCoverage,
  type CoverageContext,
  type CoverageDossier,
} from "./source-health"

describe("nom d'employeur normalisé", () => {
  it.each([
    ["SAS Hôtel du Lac", "hotel du lac"],
    ["hotel du lac", "hotel du lac"],
    ["HÔTEL DU LAC (SARL)", "hotel du lac"],
    ["La Folie Douce — Megève", "la folie douce megeve"],
    ["Société des Remontées Mécaniques", "des remontees mecaniques"],
  ])("%s → %s", (name, normalized) => {
    expect(normalizeEmployerName(name)).toBe(normalized)
  })
  it("le SIREN valide prime sur le nom ; un SIREN invalide est ignoré", () => {
    expect(employerLeadKey({ siren: "322 706 136", name: "Belambra" })).toBe(
      "employer:322706136",
    )
    expect(
      employerLeadKey({ siren: "123456789", name: "SAS Hôtel du Lac" }),
    ).toBe("employer:hotel du lac")
    expect(employerLeadKey({ name: "SARL" })).toBeNull()
  })
})

describe("couverture d'une découverte", () => {
  const today = new Date("2026-10-27T12:00:00Z")
  const day = 24 * 60 * 60 * 1000
  const context: CoverageContext = {
    coveredHosts: new Set(["recrute.belambra.fr"]),
    coveredCompanyIds: new Set(["company-vvf"]),
    leadKeys: new Set(["employer:hotel du lac"]),
    today,
  }
  const dossier = (
    daysAgo: number,
    patch: Partial<CoverageDossier> = {},
  ): CoverageDossier => ({
    at: new Date(today.getTime() - daysAgo * day),
    employerKey: null,
    officialHost: null,
    companyId: null,
    ...patch,
  })
  it("couvert par hôte ou par entreprise, à inviter par piste, sinon inconnu", () => {
    expect(
      classifyDossier(
        dossier(1, { officialHost: "recrute.belambra.fr" }),
        context,
      ),
    ).toBe("covered")
    expect(
      classifyDossier(dossier(1, { companyId: "company-vvf" }), context),
    ).toBe("covered")
    expect(
      classifyDossier(
        dossier(1, { employerKey: "employer:hotel du lac" }),
        context,
      ),
    ).toBe("to_invite")
    expect(classifyDossier(dossier(1), context)).toBe("unknown")
  })
  it("30 derniers jours, évolution sur 12 semaines, affichage", () => {
    const coverage = discoveryCoverage(
      [
        dossier(2, { officialHost: "recrute.belambra.fr" }),
        dossier(3, { employerKey: "employer:hotel du lac" }),
        dossier(4),
        dossier(45, { officialHost: "recrute.belambra.fr" }),
      ],
      context,
    )
    expect(coverage.last30).toEqual({
      covered: 1,
      toInvite: 1,
      unknown: 1,
      total: 3,
      rate: 1 / 3,
    })
    expect(coverage.previous30.total).toBe(1)
    expect(coverage.weeks).toHaveLength(12)
    expect(coverage.weeks.at(-1)?.total).toBe(3)
    expect(formatCoverage(coverage.last30)).toBe(
      "Couverture des employeurs : 33 % (1 couvert · 1 à inviter · 1 inconnu)",
    )
    expect(coverage.suggestReserve).toBe(false)
  })
  it("au-delà de 75 % deux mois de suite : proposer la réserve, sans rien changer", () => {
    const covered = (daysAgo: number) =>
      dossier(daysAgo, { officialHost: "recrute.belambra.fr" })
    expect(
      discoveryCoverage(
        [
          covered(1),
          covered(2),
          covered(3),
          dossier(4),
          covered(35),
          covered(40),
        ],
        context,
      ).suggestReserve,
    ).toBe(true)
    expect(
      discoveryCoverage([covered(1), covered(2), covered(3)], context)
        .suggestReserve,
    ).toBe(false)
    expect(formatCoverage(discoveryCoverage([], context).last30)).toBe(
      "Aucun dossier sur la période.",
    )
  })
})
