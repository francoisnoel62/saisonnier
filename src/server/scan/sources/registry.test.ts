import { expect, it } from "vitest"

import {
  scanSourceSchema,
  validateScanSourceRegistry,
} from "@/domain/scan/source"

import { buildScanSourceDefinitions } from "./registry"

it("valide toutes les sources de production, sans fixture", () => {
  const sources = buildScanSourceDefinitions()
  expect(sources.fixture).toBeUndefined()
  expect(
    validateScanSourceRegistry(sources, { environment: "production" }),
  ).toEqual([])
})

it("France Travail est prioritaire et ne se substitue jamais à l'employeur", () => {
  const sources = buildScanSourceDefinitions()
  const source = sources["france-travail"]
  expect(source).toMatchObject({
    kind: "discovery",
    role: "primary",
    priority: 0,
    employer: null,
    employerWebsite: null,
  })
  expect(
    Object.values(sources)
      .filter((item) => item.role === "primary")
      .map((item) => item.key),
  ).toEqual(["france-travail"])
  expect(
    scanSourceSchema.safeParse({
      ...source,
      employer: { name: "France Travail" },
    }).success,
  ).toBe(false)
})
it("valide la seule origine locale fournie aux tests", () => {
  const policy = {
    environment: "test" as const,
    testSourceUrl: "http://localhost:3210",
  }
  expect(
    validateScanSourceRegistry(
      buildScanSourceDefinitions(policy.testSourceUrl),
      policy,
    ),
  ).toEqual([])
  expect(
    validateScanSourceRegistry(
      buildScanSourceDefinitions(policy.testSourceUrl),
      { environment: "production" },
    ),
  ).not.toEqual([])
})
it("refuse une clé incohérente, un hôte de liste non officiel, un SIREN invalide et un alias incomplet", () => {
  const sources = buildScanSourceDefinitions()
  if (sources.vvf.kind !== "employer")
    throw new Error("Portail employeur attendu")
  sources.vvf = {
    ...sources.vvf,
    key: "belambra",
    officialHosts: ["wrong.example"],
    employer: { name: "VVF", siren: "123456789" },
    placeAliases: { station: { inseeCode: "", name: "", departmentCode: "" } },
  }
  expect(
    validateScanSourceRegistry(sources, { environment: "production" }).length,
  ).toBeGreaterThan(0)
})
