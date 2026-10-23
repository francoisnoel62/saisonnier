import { expect, it } from "vitest"

import { validateScanSourceRegistry } from "@/domain/scan/source"

import { buildScanSourceDefinitions } from "./registry"

it("valide toutes les sources de production, sans fixture", () => {
  const sources = buildScanSourceDefinitions()
  expect(sources.fixture).toBeUndefined()
  expect(
    validateScanSourceRegistry(sources, { environment: "production" }),
  ).toEqual([])
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
