import { describe, expect, it } from "vitest"

import {
  awaitsValidityAnswer,
  isReminderDue,
  type ValidityFields,
} from "./validity-reminder"

const now = new Date("2026-10-22T03:00:00Z")
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

const offer = (values: Partial<ValidityFields> = {}): ValidityFields => ({
  origin: "deposited",
  status: "published",
  publishedAt: daysAgo(30),
  validityConfirmedAt: null,
  validityReminderSentAt: null,
  ...values,
})

describe("isReminderDue", () => {
  it("29 jours après la publication : pas encore", () => {
    expect(isReminderDue(offer({ publishedAt: daysAgo(29) }), now)).toBe(false)
  })

  it("30 jours après la publication : oui", () => {
    expect(isReminderDue(offer({ publishedAt: daysAgo(30) }), now)).toBe(true)
    expect(isReminderDue(offer({ publishedAt: daysAgo(45) }), now)).toBe(true)
  })

  it("une confirmation récente repousse le rappel", () => {
    expect(
      isReminderDue(
        offer({ publishedAt: daysAgo(60), validityConfirmedAt: daysAgo(3) }),
        now,
      ),
    ).toBe(false)
  })

  it("un rappel envoyé il y a moins de 30 jours n'est pas renvoyé, même sans réponse", () => {
    expect(
      isReminderDue(
        offer({
          publishedAt: daysAgo(50),
          validityReminderSentAt: daysAgo(20),
        }),
        now,
      ),
    ).toBe(false)
    expect(
      isReminderDue(
        offer({
          publishedAt: daysAgo(70),
          validityReminderSentAt: daysAgo(30),
        }),
        now,
      ),
    ).toBe(true)
  })

  it("une annonce collectée : jamais", () => {
    expect(
      isReminderDue(
        offer({ origin: "collected", publishedAt: daysAgo(90) }),
        now,
      ),
    ).toBe(false)
  })

  it("une annonce qui n'est pas publiée : jamais", () => {
    for (const status of [
      "pending_review",
      "unpublished",
      "expired",
      "rejected",
    ] as const) {
      expect(
        isReminderDue(offer({ status, publishedAt: daysAgo(90) }), now),
      ).toBe(false)
    }
    expect(isReminderDue(offer({ publishedAt: null }), now)).toBe(false)
  })
})

describe("awaitsValidityAnswer", () => {
  it("attend une réponse quand le rappel suit la dernière confirmation", () => {
    expect(
      awaitsValidityAnswer(
        offer({
          validityConfirmedAt: daysAgo(40),
          validityReminderSentAt: daysAgo(2),
        }),
      ),
    ).toBe(true)
    expect(
      awaitsValidityAnswer(offer({ validityReminderSentAt: daysAgo(2) })),
    ).toBe(true)
  })

  it("plus après la réponse, ni sans rappel, ni hors ligne", () => {
    expect(
      awaitsValidityAnswer(
        offer({
          validityConfirmedAt: daysAgo(1),
          validityReminderSentAt: daysAgo(2),
        }),
      ),
    ).toBe(false)
    expect(awaitsValidityAnswer(offer())).toBe(false)
    expect(
      awaitsValidityAnswer(
        offer({ status: "unpublished", validityReminderSentAt: daysAgo(2) }),
      ),
    ).toBe(false)
  })
})
