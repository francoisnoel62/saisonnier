import { eq, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { todayInParis } from "@/domain/offer-activity"
import {
  adminOfferInputSchema,
  emptyAdminOfferFormValues,
  offerInputContext,
  type AdminOfferFormValues,
} from "@/domain/offer-input"
import { db } from "@/lib/db"
import { companies, offers, user } from "@/lib/db/schema"

import { getOfferFormReferentials } from "./employer-offers"
import { upsertCollectedOffer, type CollectedOfferInput } from "./ingest"

// SIREN propre à ce fichier (clé de Luhn valide), absent du jeu de démonstration.
const SIREN = "300000007"
const SOURCE = "https://www.hotel-ingest.example/emplois/serveur"
const actor = { kind: "admin", userId: "ingest-int-admin" } as const

let companyId: string
let schema: ReturnType<typeof adminOfferInputSchema>

// Annonce collectée minimale, validée par le schéma du back-office : candidature par le seul
// lien officiel.
function collected(values: Partial<AdminOfferFormValues> = {}) {
  const input = schema.parse({
    ...emptyAdminOfferFormValues(),
    companyId,
    sourceUrl: SOURCE,
    sourceName: "Site carrières de l'Hôtel Ingest",
    title: "Serveur / serveuse",
    seasonalContract: true,
    season: "summer",
    periodKind: "duration",
    durationValue: "3",
    durationUnit: "months",
    communeName: "Lacanau",
    departmentCode: "33",
    applyUrl: "https://www.hotel-ingest.example/candidature",
    ...values,
  })
  return { ...input, sourceUrl: input.sourceUrl! } satisfies CollectedOfferInput
}

async function rowsWithSource(sourceUrl: string) {
  return db.select().from(offers).where(eq(offers.sourceUrl, sourceUrl))
}

async function cleanUp() {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.siren, SIREN))
  if (company) {
    await db.delete(offers).where(eq(offers.companyId, company.id))
    await db.delete(companies).where(eq(companies.id, company.id))
  }
}

beforeAll(async () => {
  await cleanUp()
  await db
    .insert(user)
    .values({
      id: actor.userId,
      name: "Admin de test",
      email: "ingest-admin@test.example",
      role: "admin",
    })
    .onConflictDoNothing()
  const [company] = await db
    .insert(companies)
    .values({ legalName: "Hôtel Ingest", siren: SIREN })
    .returning()
  companyId = company.id
  schema = adminOfferInputSchema(
    offerInputContext(
      await getOfferFormReferentials(),
      todayInParis(new Date()),
    ),
  )
})

afterAll(async () => {
  await cleanUp()
  await db.delete(user).where(eq(user.id, actor.userId))
  await db.$client.end()
})

describe("upsertCollectedOffer", () => {
  it("crée une annonce vérifiée par un humain et refuse une seconde saisie de sa source", async () => {
    const first = new Date("2026-10-20T08:00:00Z")
    const created = await upsertCollectedOffer(collected(), actor, {
      now: first,
    })
    expect(created).toMatchObject({ ok: true, created: true })

    const [inserted] = await rowsWithSource(SOURCE)
    expect(inserted).toMatchObject({
      origin: "collected",
      status: "published",
      companyId,
      createdByUserId: null,
      title: "Serveur / serveuse",
      publishedAt: first,
      sourceCheckedAt: first,
      humanVerifiedAt: first,
      humanVerifiedByUserId: actor.userId,
    })

    const second = new Date("2026-10-22T08:00:00Z")
    const updated = await upsertCollectedOffer(
      collected({ title: "Serveur / serveuse (H/F)", housing: "yes" }),
      actor,
      { now: second },
    )
    expect(updated).toEqual({
      ok: false,
      reason: "source_taken",
      offerId: inserted.id,
    })

    const rows = await rowsWithSource(SOURCE)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: inserted.id,
      title: "Serveur / serveuse",
      housing: "unknown",
      publishedAt: first,
      sourceCheckedAt: first,
    })
  })

  it("conserve le lien saisi : routes #/… distinctes, barre finale et paramètres intacts", async () => {
    const site = "https://jobs.hotel-ingest.example"
    const a = await upsertCollectedOffer(
      collected({ sourceUrl: `${site}/#/offre/12`, title: "Serveur" }),
      actor,
    )
    const b = await upsertCollectedOffer(
      collected({ sourceUrl: `${site}/#/offre/34`, title: "Cuisinier" }),
      actor,
    )
    expect(a).toMatchObject({ ok: true, created: true })
    expect(b).toMatchObject({ ok: true, created: true })
    const tracked = `${site}/emplois/plongeur/?utm_source=x&b=2&a=1`
    const c = await upsertCollectedOffer(
      collected({ sourceUrl: tracked, title: "Plongeur" }),
      actor,
    )
    if (!c.ok) throw new Error(c.reason)
    const [row] = await db.select().from(offers).where(eq(offers.id, c.offerId))
    expect(row.sourceUrl).toBe(tracked)
    // Le même lien, au suivi près, reste refusé comme source déjà utilisée.
    expect(
      await upsertCollectedOffer(
        collected({ sourceUrl: `${site}/emplois/plongeur?a=1&b=2` }),
        actor,
      ),
    ).toEqual({ ok: false, reason: "source_taken", offerId: c.offerId })
  })

  it("refuse une nouvelle saisie d'une annonce retirée sans la remettre en ligne", async () => {
    const source = `${SOURCE}-retiree`
    const result = await upsertCollectedOffer(
      collected({ sourceUrl: source }),
      actor,
    )
    if (!result.ok) throw new Error(result.reason)
    await db
      .update(offers)
      .set({ status: "unpublished", unpublishedAt: new Date() })
      .where(eq(offers.id, result.offerId))

    await upsertCollectedOffer(collected({ sourceUrl: source }), actor)
    const [row] = await rowsWithSource(source)
    expect(row.status).toBe("unpublished")
    expect(row.unpublishedAt).not.toBeNull()
  })

  it("refuse une source indeed.fr et en donne le motif", async () => {
    const source = "https://www.indeed.fr/emplois/serveur"
    const result = await upsertCollectedOffer(
      { ...collected(), sourceUrl: source },
      actor,
    )
    expect(result).toEqual({
      ok: false,
      reason: "rejected",
      missing: [
        {
          requirement: "blocked_domain",
          label:
            "La source indeed.fr n'est pas acceptée : seuls les sites et portails officiels des employeurs le sont.",
        },
      ],
      blocked: [{ field: "sourceUrl", host: "indeed.fr", domain: "indeed.fr" }],
    })
    expect(await rowsWithSource(source)).toEqual([])
  })

  it("refuse une destination de candidature exclue, même avec une source officielle", async () => {
    const source = `${SOURCE}-linkedin`
    const result = await upsertCollectedOffer(
      {
        ...collected({ sourceUrl: source }),
        applyUrl: "https://www.linkedin.com/jobs/view/123",
      },
      actor,
    )
    expect(result).toMatchObject({
      ok: false,
      reason: "rejected",
      blocked: [{ field: "applyUrl", domain: "linkedin.com" }],
    })
    expect(await rowsWithSource(source)).toEqual([])
  })

  it("refuse une entreprise inconnue : l'entreprise doit être identifiable", async () => {
    const result = await upsertCollectedOffer(
      {
        ...collected({ sourceUrl: `${SOURCE}-inconnue` }),
        companyId: "00000000-0000-4000-8000-000000000000",
      },
      actor,
    )
    expect(result).toMatchObject({
      ok: false,
      reason: "rejected",
      missing: [{ requirement: "company" }],
    })
  })

  it("modifie une annonce précise, et refuse la source d'une autre annonce collectée", async () => {
    const a = await upsertCollectedOffer(
      collected({ sourceUrl: `${SOURCE}-a` }),
      actor,
    )
    const b = await upsertCollectedOffer(
      collected({ sourceUrl: `${SOURCE}-b` }),
      actor,
    )
    if (!a.ok || !b.ok) throw new Error("création impossible")

    const moved = await upsertCollectedOffer(
      collected({ sourceUrl: `${SOURCE}-a2`, title: "Barman" }),
      actor,
      { offerId: a.offerId },
    )
    expect(moved).toEqual({ ok: true, offerId: a.offerId, created: false })
    const [row] = await rowsWithSource(`${SOURCE}-a2`)
    expect(row).toMatchObject({ id: a.offerId, title: "Barman" })

    expect(
      await upsertCollectedOffer(
        collected({ sourceUrl: `${SOURCE}-b` }),
        actor,
        { offerId: a.offerId },
      ),
    ).toEqual({ ok: false, reason: "source_taken", offerId: b.offerId })
  })

  it.each(["unpublished", "expired", "rejected"] as const)(
    "modifie le contenu d'une annonce %s en préservant son cycle de vie",
    async (status) => {
      const source = `${SOURCE}-${status}`
      const saved = await upsertCollectedOffer(
        collected({ sourceUrl: source }),
        actor,
      )
      if (!saved.ok) throw new Error(saved.reason)
      const withdrawnAt = new Date("2026-10-23T10:00:00Z")
      await db
        .update(offers)
        .set({ status, unpublishedAt: withdrawnAt, expiredAt: withdrawnAt })
        .where(eq(offers.id, saved.offerId))
      const [before] = await rowsWithSource(source)
      await upsertCollectedOffer(
        collected({ sourceUrl: source, title: "Titre corrigé" }),
        actor,
        { offerId: saved.offerId },
      )
      const [after] = await rowsWithSource(source)
      expect(after).toMatchObject({
        title: "Titre corrigé",
        status,
        publishedAt: before.publishedAt,
        unpublishedAt: withdrawnAt,
        expiredAt: withdrawnAt,
        humanVerifiedAt: before.humanVerifiedAt,
        humanVerifiedByUserId: before.humanVerifiedByUserId,
      })
    },
  )

  it("sérialise deux créations d'une même URL canonique", async () => {
    const source = `${SOURCE}-concurrent`
    const results = await Promise.all([
      upsertCollectedOffer(
        collected({ sourceUrl: `${source}/?utm_source=test#top` }),
        actor,
      ),
      upsertCollectedOffer(collected({ sourceUrl: source }), actor),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(
      results.filter((r) => !r.ok && r.reason === "source_taken"),
    ).toHaveLength(1)
    // Le lien saisi est conservé tel quel : le gagnant de la course peut être l'un ou l'autre.
    expect(
      await db
        .select()
        .from(offers)
        .where(like(offers.sourceUrl, `${source}%`)),
    ).toHaveLength(1)
  })
})
