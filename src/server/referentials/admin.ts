import "server-only"

import { and, asc, count, desc, eq, isNotNull, max, or } from "drizzle-orm"

import {
  findBlockedTargets,
  type BlockedTarget,
} from "@/domain/blocked-domains"
import {
  moveInOrder,
  occupationSlug,
  type OccupationInput,
} from "@/domain/occupation"
import { db } from "@/lib/db"
import { blockedDomains, companies, occupations, offers } from "@/lib/db/schema"

// Référentiels gérés par l'admin (plan 15) : métiers et domaines exclus. Les autres (régions,
// départements) ne changent que par migration.

// Métiers dans l'ordre du référentiel, avec le nombre d'annonces qui les citent.
export async function listOccupationsForAdmin() {
  return db
    .select({
      id: occupations.id,
      slug: occupations.slug,
      label: occupations.label,
      family: occupations.family,
      sortOrder: occupations.sortOrder,
      isActive: occupations.isActive,
      offerCount: count(offers.id),
    })
    .from(occupations)
    .leftJoin(offers, eq(offers.occupationId, occupations.id))
    .groupBy(occupations.id)
    .orderBy(asc(occupations.sortOrder), asc(occupations.label))
}

export type AdminOccupation = Awaited<
  ReturnType<typeof listOccupationsForAdmin>
>[number]

// Familles existantes, pour proposer les mêmes libellés à l'ajout.
export async function listOccupationFamilies() {
  const rows = await db
    .selectDistinct({ family: occupations.family })
    .from(occupations)
    .orderBy(asc(occupations.family))
  return rows.map((row) => row.family)
}

// Nouveau métier, actif, placé après les derniers de sa famille. Son identifiant d'URL est
// dérivé de l'intitulé, et rendu unique.
export async function addOccupation({ label, family }: OccupationInput) {
  return db.transaction(async (tx) => {
    const base = occupationSlug(label)
    const taken = new Set(
      (await tx.select({ slug: occupations.slug }).from(occupations)).map(
        (row) => row.slug,
      ),
    )
    let slug = base
    for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`

    const [last] = await tx
      .select({ sortOrder: max(occupations.sortOrder) })
      .from(occupations)
      .where(eq(occupations.family, family))
    const [overall] = await tx
      .select({ sortOrder: max(occupations.sortOrder) })
      .from(occupations)
    const sortOrder =
      last?.sortOrder !== null && last?.sortOrder !== undefined
        ? last.sortOrder + 1
        : (overall?.sortOrder ?? 0) + 10

    const [created] = await tx
      .insert(occupations)
      .values({ slug, label, family, sortOrder })
      .returning()
    return created
  })
}

// Renommer : l'identifiant d'URL ne change pas, les recherches partagées restent valables.
export async function updateOccupation(id: string, input: OccupationInput) {
  const [updated] = await db
    .update(occupations)
    .set(input)
    .where(eq(occupations.id, id))
    .returning({ id: occupations.id })
  return !!updated
}

export async function setOccupationActive(id: string, isActive: boolean) {
  const [updated] = await db
    .update(occupations)
    .set({ isActive })
    .where(eq(occupations.id, id))
    .returning({ id: occupations.id })
  return !!updated
}

// Monte ou descend un métier d'un cran ; l'ordre est renuméroté de 10 en 10.
export async function moveOccupation(id: string, direction: "up" | "down") {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: occupations.id, sortOrder: occupations.sortOrder })
      .from(occupations)
      .orderBy(asc(occupations.sortOrder), asc(occupations.label))
      .for("update")
    if (!rows.some((row) => row.id === id)) return false

    const order = moveInOrder(
      rows.map((row) => row.id),
      id,
      direction,
    )
    const current = new Map(rows.map((row) => [row.id, row.sortOrder]))
    for (const [index, occupationId] of order.entries()) {
      const sortOrder = (index + 1) * 10
      if (current.get(occupationId) !== sortOrder) {
        await tx
          .update(occupations)
          .set({ sortOrder })
          .where(eq(occupations.id, occupationId))
      }
    }
    return true
  })
}

export async function listBlockedDomainsForAdmin() {
  return db
    .select()
    .from(blockedDomains)
    .orderBy(desc(blockedDomains.createdAt), asc(blockedDomains.domain))
}

// Renvoie false si le domaine était déjà exclu.
export async function addBlockedDomain(domain: string, reason: string) {
  const [created] = await db
    .insert(blockedDomains)
    .values({ domain, reason })
    .onConflictDoNothing()
    .returning({ domain: blockedDomains.domain })
  return !!created
}

export async function removeBlockedDomain(domain: string) {
  const [removed] = await db
    .delete(blockedDomains)
    .where(eq(blockedDomains.domain, domain))
    .returning({ domain: blockedDomains.domain })
  return !!removed
}

export type AffectedOffer = {
  id: string
  title: string
  companyName: string
  targets: BlockedTarget[]
}

// Annonces publiées dont un lien, un email ou la source mène à l'un de ces domaines : à corriger.
// La fiche masque déjà ces destinations (§9) ; l'admin les remplace par un contact direct.
export async function publishedOffersPointingTo(
  domains: readonly string[],
): Promise<AffectedOffer[]> {
  if (domains.length === 0) return []
  const rows = await db
    .select({
      id: offers.id,
      title: offers.title,
      applyEmail: offers.applyEmail,
      applyUrl: offers.applyUrl,
      sourceUrl: offers.sourceUrl,
      legalName: companies.legalName,
      displayName: companies.displayName,
    })
    .from(offers)
    .innerJoin(companies, eq(companies.id, offers.companyId))
    .where(
      and(
        eq(offers.status, "published"),
        or(
          isNotNull(offers.applyEmail),
          isNotNull(offers.applyUrl),
          isNotNull(offers.sourceUrl),
        ),
      ),
    )
    .orderBy(desc(offers.publishedAt), asc(offers.id))
  return rows.flatMap((offer) => {
    const targets = findBlockedTargets(offer, domains)
    return targets.length > 0
      ? [
          {
            id: offer.id,
            title: offer.title,
            companyName: offer.displayName ?? offer.legalName,
            targets,
          },
        ]
      : []
  })
}
