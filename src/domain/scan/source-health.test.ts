import { describe, expect, it } from "vitest"

import { employerLeadKey, normalizeEmployerName } from "./employer-lead"
import {
  autoPublishReadiness,
  classifyDossier,
  discoveryCoverage,
  formatCoverage,
  qualificationDue,
  robotsChanged,
  shouldSuspendSource,
  sourceHealth,
  type CoverageContext,
  type CoverageDossier,
  type RunSourceOutcome,
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

describe("santé et disjoncteur (lot E)", () => {
  const run = (
    status: RunSourceOutcome["status"],
    patch: Partial<RunSourceOutcome> = {},
  ): RunSourceOutcome => ({
    status,
    mode: "daily",
    failedCount: 0,
    robotsDigest: null,
    ...patch,
  })
  it("santé d'après le dernier passage terminé", () => {
    expect(sourceHealth([], { suspended: false })).toBe("unknown")
    expect(sourceHealth([run("done")], { suspended: true })).toBe("suspended")
    expect(
      sourceHealth([run("processing"), run("done")], { suspended: false }),
    ).toBe("healthy")
    expect(sourceHealth([run("blocked")], { suspended: false })).toBe("blocked")
    expect(sourceHealth([run("failed")], { suspended: false })).toBe("degraded")
    expect(
      sourceHealth([run("done", { failedCount: 2 })], { suspended: false }),
    ).toBe("degraded")
  })
  it("trois passages bloqués de suite suspendent ; une indisponibilité non", () => {
    expect(shouldSuspendSource([run("blocked"), run("blocked")])).toBe(false)
    expect(
      shouldSuspendSource([run("blocked"), run("blocked"), run("blocked")]),
    ).toBe(true)
    expect(
      shouldSuspendSource([
        run("blocked"),
        run("failed"),
        run("blocked"),
        run("blocked"),
      ]),
    ).toBe(false)
    expect(
      shouldSuspendSource([
        run("listing"),
        run("blocked"),
        run("blocked"),
        run("blocked"),
      ]),
    ).toBe(true)
  })
  it("publication automatique : trois passages quotidiens sans échec recommandés", () => {
    expect(autoPublishReadiness([run("done"), run("done")]).ready).toBe(false)
    expect(
      autoPublishReadiness([
        run("done"),
        run("done", { failedCount: 1 }),
        run("done", { mode: "bootstrap" }),
        run("done"),
        run("done"),
      ]),
    ).toEqual({ ready: true, clean: 3, needed: 3 })
  })
  it("qualification à renouveler au-delà de 180 jours ; robots.txt modifié", () => {
    const today = new Date("2026-10-27T00:00:00Z")
    expect(qualificationDue("2026-10-23", today)).toBe(false)
    expect(qualificationDue("2026-04-01", today)).toBe(true)
    expect(qualificationDue(null, today)).toBe(true)
    expect(
      robotsChanged([
        run("done", { robotsDigest: "b" }),
        run("done"),
        run("done", { robotsDigest: "a" }),
      ]),
    ).toBe(true)
    expect(
      robotsChanged([
        run("done", { robotsDigest: "a" }),
        run("done", { robotsDigest: "a" }),
      ]),
    ).toBe(false)
  })
})
