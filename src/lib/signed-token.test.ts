import { describe, expect, it } from "vitest"

import {
  safeEqual,
  signOfferToken,
  TOKEN_LIFETIME_DAYS,
  verifyOfferToken,
} from "./signed-token"

const SECRET = "secret-de-test-assez-long-pour-hmac-sha256"
const OFFER_ID = "5d1b7c1e-8f0a-4c3e-9b52-6f0e2a4d7c11"
const now = new Date("2026-10-22T03:00:00Z")
const DAY_MS = 24 * 60 * 60 * 1000

describe("jeton signé", () => {
  it("une signature valide donne l'annonce", () => {
    const token = signOfferToken(OFFER_ID, SECRET, now)
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/)
    expect(verifyOfferToken(token, SECRET, now)).toEqual({
      ok: true,
      offerId: OFFER_ID,
    })
  })

  it("expire au bout de 30 jours", () => {
    const token = signOfferToken(OFFER_ID, SECRET, now)
    const almost = new Date(now.getTime() + TOKEN_LIFETIME_DAYS * DAY_MS - 1000)
    const after = new Date(now.getTime() + TOKEN_LIFETIME_DAYS * DAY_MS)
    expect(verifyOfferToken(token, SECRET, almost).ok).toBe(true)
    expect(verifyOfferToken(token, SECRET, after)).toEqual({
      ok: false,
      reason: "expired",
    })
  })

  it("refuse un jeton altéré, ou signé avec un autre secret", () => {
    const token = signOfferToken(OFFER_ID, SECRET, now)
    const [data, signature] = token.split(".")

    // Autre annonce, ancienne signature.
    const forged = Buffer.from(
      JSON.stringify({ offerId: "autre", exp: 9_999_999_999 }),
    ).toString("base64url")
    expect(verifyOfferToken(`${forged}.${signature}`, SECRET, now)).toEqual({
      ok: false,
      reason: "invalid",
    })
    const flipped = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`
    expect(verifyOfferToken(`${data}.${flipped}`, SECRET, now).ok).toBe(false)
    expect(verifyOfferToken(token, `${SECRET}-autre`, now).ok).toBe(false)
  })

  it("refuse ce qui n'est pas un jeton", () => {
    for (const value of ["", "abc", "a.b.c", ".", `${OFFER_ID}.`]) {
      expect(verifyOfferToken(value, SECRET, now)).toEqual({
        ok: false,
        reason: "invalid",
      })
    }
  })
})

describe("safeEqual", () => {
  it("compare des valeurs de longueurs quelconques", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true)
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false)
    expect(safeEqual("Bearer abc", "Bearer abcd")).toBe(false)
    expect(safeEqual("", "")).toBe(true)
  })
})
