import { createHmac, timingSafeEqual } from "node:crypto"

// Jeton signé des liens envoyés par email (plan 16) : HMAC-SHA256 sur { offerId, exp }. Il se lit
// sans base ni session, et toute altération invalide la signature.

export const TOKEN_LIFETIME_DAYS = 30

const DAY_S = 24 * 60 * 60

export type OfferTokenPayload = {
  offerId: string
  // Expiration, en secondes depuis l'époque Unix.
  exp: number
}

export type VerifiedToken =
  { ok: true; offerId: string } | { ok: false; reason: "invalid" | "expired" }

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url")

function signature(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest()
}

// Comparaison en temps constant : la durée ne révèle rien de la valeur attendue.
export function safeEqual(a: string | Buffer, b: string | Buffer) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// "<données>.<signature>", en base64url : le jeton tient dans un chemin d'URL.
export function signOfferToken(
  offerId: string,
  secret: string,
  now = new Date(),
) {
  const payload: OfferTokenPayload = {
    offerId,
    exp: Math.floor(now.getTime() / 1000) + TOKEN_LIFETIME_DAYS * DAY_S,
  }
  const data = base64url(JSON.stringify(payload))
  return `${data}.${base64url(signature(data, secret))}`
}

export function verifyOfferToken(
  token: string,
  secret: string,
  now = new Date(),
): VerifiedToken {
  const invalid = { ok: false, reason: "invalid" } as const
  const parts = typeof token === "string" ? token.split(".") : []
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid
  const [data, received] = parts

  if (!safeEqual(Buffer.from(received, "base64url"), signature(data, secret))) {
    return invalid
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"))
  } catch {
    return invalid
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as OfferTokenPayload).offerId !== "string" ||
    typeof (payload as OfferTokenPayload).exp !== "number"
  ) {
    return invalid
  }
  const { offerId, exp } = payload as OfferTokenPayload
  if (exp * 1000 <= now.getTime()) return { ok: false, reason: "expired" }
  return { ok: true, offerId }
}
