import { describe, expect, it } from "vitest"
import {
  duplicatePlaceIndices,
  MAX_EXTRA_LOCATIONS,
  offerPlaces,
  placesSummary,
} from "./offer-places"
import {
  adminOfferInputSchema,
  adminOfferToFormValues,
  areExtraLocationsValid,
  emptyAdminOfferFormValues,
  offerInputSchema,
} from "./offer-input"

const primary = {
  communeName: "Praz-sur-Arly",
  departmentCode: "74",
  communeInseeCode: "74215",
  department: { code: "74", name: "Haute-Savoie" },
}
const extra = {
  communeName: "Lacanau",
  departmentCode: "33",
  communeInseeCode: "33214",
  postalCode: "33680",
  locationDetails: "Au lac",
}
describe("lieux du poste", () => {
  it("garde le lieu principal puis les autres dans l'ordre, sans contacts ni mutation", () => {
    const extras = [
      { ...extra, position: 2 },
      { communeName: "Tignes", departmentCode: "73", position: 1 },
    ]
    const places = offerPlaces(
      { ...primary, applyEmail: "rh@hotel.example" } as typeof primary,
      extras,
    )
    expect(places.map((place) => place.communeName)).toEqual([
      "Praz-sur-Arly",
      "Tignes",
      "Lacanau",
    ])
    expect(extras[0].position).toBe(2)
    expect(JSON.stringify(places)).not.toContain("applyEmail")
    expect(placesSummary(places)).toBe(
      "Praz-sur-Arly · Haute-Savoie (74) et 2 autres lieux",
    )
    expect(placesSummary(places.slice(0, 2))).toContain("et 1 autre lieu")
    expect(placesSummary(places.slice(0, 1))).not.toContain("autre")
    expect(placesSummary([])).toBe("Lieu non précisé")
  })
  it("détecte les doublons avec ou sans code connu", () => {
    expect(duplicatePlaceIndices(primary, [primary])).toEqual([0])
    expect(
      duplicatePlaceIndices(primary, [
        {
          ...primary,
          communeInseeCode: null,
          communeName: "  PRAZ-SUR-ARLY  ",
        },
      ]),
    ).toEqual([0])
    expect(duplicatePlaceIndices(primary, [extra, extra])).toEqual([1])
  })
})

describe("saisie admin de plusieurs lieux", () => {
  const context = {
    today: "2026-10-24",
    blockedDomains: [],
    occupationIds: [],
    departmentCodes: ["74", "73", "33"],
  }
  const input = {
    ...emptyAdminOfferFormValues(),
    ...primary,
    communeInseeCode: "74215",
    title: "Serveur",
    companyId: "company",
    origin: "deposited" as const,
    seasonalContract: true,
    periodKind: "duration" as const,
    durationValue: "3",
    durationUnit: "months",
    applyEmail: "rh@hotel.example",
    extraLocations: [{ ...extra, communeInseeCode: "33214" }],
  }
  const schema = adminOfferInputSchema(context)
  it("valide et préremplit les lieux dans l'ordre", () => {
    const parsed = schema.parse(input)
    expect(parsed.extraLocations).toEqual([extra])
    expect(adminOfferToFormValues(parsed).extraLocations).toEqual(
      input.extraLocations,
    )
    expect(
      areExtraLocationsValid(primary, [extra], context.departmentCodes),
    ).toBe(true)
  })
  it("accepte vingt autres lieux et conserve le dépôt employeur à un seul lieu", () => {
    const extraLocations = Array.from(
      { length: MAX_EXTRA_LOCATIONS },
      (_, index) => ({
        ...extra,
        communeName: `Lieu ${index}`,
        communeInseeCode: "",
      }),
    )
    expect(schema.safeParse({ ...input, extraLocations }).success).toBe(true)
    expect(
      offerInputSchema(context).parse({ ...input, extraLocations }),
    ).not.toHaveProperty("extraLocations")
  })
  it.each([
    ["doublon du lieu principal", [{ ...extra, ...primary }]],
    ["doublon entre lieux supplémentaires", [extra, extra]],
    ["département inconnu", [{ ...extra, departmentCode: "00" }]],
    ["code INSEE hors département", [{ ...extra, communeInseeCode: "74001" }]],
    ["code postal invalide", [{ ...extra, postalCode: "abc" }]],
    [
      "plafond",
      Array.from({ length: MAX_EXTRA_LOCATIONS + 1 }, (_, i) => ({
        ...extra,
        communeName: `Lieu ${i}`,
        communeInseeCode: "",
      })),
    ],
  ])("refuse %s", (_, extraLocations) => {
    expect(schema.safeParse({ ...input, extraLocations }).success).toBe(false)
    expect(
      areExtraLocationsValid(primary, extraLocations, context.departmentCodes),
    ).toBe(false)
  })
})
