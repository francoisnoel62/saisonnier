import { describe, expect, it } from "vitest"

import {
  contactSchema,
  handleContactSchema,
  isRateLimited,
  MESSAGE_MAX_LENGTH,
  MESSAGES_PER_HOUR,
  topicFromSlug,
} from "./contact"

const valid = {
  topic: "employer",
  name: "  Léa Martin ",
  email: " LEA@Example.COM ",
  companyName: "",
  phone: " ",
  message: " Bonjour ",
  offerId: "",
}

describe("contactSchema", () => {
  it("nettoie les champs et ignore les champs facultatifs vides", () => {
    const parsed = contactSchema.parse(valid)
    expect(parsed).toEqual({
      topic: "employer",
      name: "Léa Martin",
      email: "lea@example.com",
      companyName: undefined,
      phone: undefined,
      message: "Bonjour",
      offerId: undefined,
    })
  })

  it("accepte un message de 3 000 caractères et refuse 3 001", () => {
    const at = (length: number) =>
      contactSchema.safeParse({ ...valid, message: "a".repeat(length) })
    expect(at(MESSAGE_MAX_LENGTH).success).toBe(true)
    expect(at(MESSAGE_MAX_LENGTH + 1).success).toBe(false)
  })

  it("refuse un sujet inconnu, un email invalide et un message vide", () => {
    expect(contactSchema.safeParse({ ...valid, topic: "x" }).success).toBe(
      false,
    )
    expect(
      contactSchema.safeParse({ ...valid, email: "pas-un-email" }).success,
    ).toBe(false)
    expect(contactSchema.safeParse({ ...valid, message: "   " }).success).toBe(
      false,
    )
  })

  it("exige un identifiant d'annonce valide quand il est fourni", () => {
    const id = "0b0c8f7e-5d8e-4c53-9f0e-2f2b3b6f7a10"
    expect(contactSchema.parse({ ...valid, offerId: id }).offerId).toBe(id)
    expect(
      contactSchema.safeParse({ ...valid, offerId: "n'importe quoi" }).success,
    ).toBe(false)
  })
})

describe("topicFromSlug", () => {
  it("traduit le motif de l'URL", () => {
    expect(topicFromSlug("annonce-collectee")).toBe("collected_offer")
    expect(topicFromSlug("employeur")).toBe("employer")
  })

  it("retombe sur « autre » pour un motif absent ou inconnu", () => {
    expect(topicFromSlug(undefined)).toBe("other")
    expect(topicFromSlug("toString")).toBe("other")
  })
})

describe("isRateLimited", () => {
  it("laisse passer jusqu'à la limite puis bloque", () => {
    expect(isRateLimited(MESSAGES_PER_HOUR - 1)).toBe(false)
    expect(isRateLimited(MESSAGES_PER_HOUR)).toBe(true)
  })
})

describe("handleContactSchema", () => {
  it("transforme une note vide en absence de note", () => {
    const id = "0b0c8f7e-5d8e-4c53-9f0e-2f2b3b6f7a10"
    expect(handleContactSchema.parse({ id, adminNote: "  " }).adminNote).toBe(
      undefined,
    )
  })
})
