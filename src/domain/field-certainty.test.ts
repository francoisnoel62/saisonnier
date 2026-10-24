import { describe, expect, it } from "vitest"
import {
  confirmableFields,
  establishFields,
  isToConfirm,
} from "./field-certainty"
import {
  emptyOfferFormValues,
  previewOfferInput,
  emptyAdminOfferFormValues,
  adminOfferInputSchema,
} from "./offer-input"

describe("champs à confirmer", () => {
  const neutral = previewOfferInput(emptyOfferFormValues())
  it("garde les inconnus et retire seulement les champs établis", () => {
    expect(establishFields(neutral, confirmableFields)).toEqual(
      confirmableFields,
    )
    expect(
      establishFields(
        {
          ...neutral,
          housing: "yes",
          meals: "no",
          salaryGrossMinCents: 200000,
          salaryGrossUnit: "month",
          workTime: "full_time",
        },
        confirmableFields,
      ),
    ).toEqual(["experience", "driving_license", "couples", "pets", "languages"])
    expect(isToConfirm({ fieldsToConfirm: ["housing"] }, "housing")).toBe(true)
    expect(isToConfirm({}, "salary")).toBe(false)
  })
  it("le schéma admin valide les mentions et les lève avec une valeur", () => {
    const input = {
      ...emptyAdminOfferFormValues(),
      origin: "deposited" as const,
      companyId: "company",
      title: "Serveur",
      seasonalContract: true,
      periodKind: "duration" as const,
      durationValue: "3",
      durationUnit: "months",
      communeName: "Huez",
      departmentCode: "38",
      applyEmail: "rh@hotel.example",
      housing: "no",
      fieldsToConfirm: ["housing", "salary"],
      additionalInfo: "  Accueil sur place.  ",
    }
    const schema = adminOfferInputSchema({
      today: "2026-10-24",
      departmentCodes: ["38"],
      occupationIds: [],
      blockedDomains: [],
    })
    expect(schema.parse(input)).toMatchObject({
      fieldsToConfirm: ["salary"],
      additionalInfo: "Accueil sur place.",
    })
    expect(
      schema.safeParse({ ...input, fieldsToConfirm: ["invented"] }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ ...input, additionalInfo: "a".repeat(1001) }).success,
    ).toBe(false)
  })
})
