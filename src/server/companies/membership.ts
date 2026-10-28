import "server-only"

import { and, desc, eq, ne } from "drizzle-orm"

import type {
  CompanyDetails,
  CompanyOnboarding,
  MembershipDecision,
} from "@/domain/membership"
import { db } from "@/lib/db"
import {
  companies,
  companyMembers,
  offers,
  scanReviews,
  user,
} from "@/lib/db/schema"

// Rattachement employeur ↔ entreprise (plan 13, H2). L'appelant passe l'identifiant de la
// session, jamais une valeur venue de la requête.

export async function getMembership(userId: string) {
  const [row] = await db
    .select({ member: companyMembers, company: companies })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, userId))
  return row ?? null
}

export type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>

export class MembershipExistsError extends Error {
  constructor() {
    super("Ce compte est déjà rattaché à une entreprise.")
  }
}

// Crée le rattachement, en attente de vérification. Une entreprise déjà connue (même SIREN) est
// reprise telle quelle, sans doublon ni modification de sa fiche.
export async function createMembership(
  userId: string,
  {
    jobTitle,
    relationship,
    relationshipDetails,
    phone,
    ...company
  }: CompanyOnboarding,
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(companies)
      .values({
        legalName: company.legalName,
        displayName: company.displayName,
        siren: company.siren,
        siret: company.siret,
        nafCode: company.nafCode,
        nafLabel: company.nafLabel,
        communeName: company.communeName,
        website: company.website,
      })
      .onConflictDoNothing({ target: companies.siren })
      .returning()
    const target =
      created ??
      (
        await tx
          .select()
          .from(companies)
          .where(eq(companies.siren, company.siren))
      )[0]

    const [member] = await tx
      .insert(companyMembers)
      .values({
        userId,
        companyId: target.id,
        jobTitle,
        relationship,
        relationshipDetails,
        phone,
      })
      .onConflictDoNothing({ target: companyMembers.userId })
      .returning()
    if (!member) throw new MembershipExistsError()
    // Un employeur repéré par la découverte crée son compte : sa piste est résolue (lot F du
    // plan scan V2-01). Le rattachement reste vérifié par l'admin (H2).
    await tx
      .update(scanReviews)
      .set({
        status: "resolved",
        decision: { decision: "account_created", companyId: target.id },
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(scanReviews.kind, "employer_lead"),
          eq(scanReviews.groupKey, `employer:${company.siren}`),
          ne(scanReviews.status, "dismissed"),
        ),
      )

    return { company: target, member, existingCompany: !created }
  })
}

// Enseigne et site sont ceux de l'entreprise : seul un déposant vérifié les modifie, ou le
// déposant en attente d'une entreprise que personne n'a encore fait vérifier. Le téléphone est
// celui du déposant. Un rattachement refusé ne se modifie plus.
export async function updateCompanyDetails(
  userId: string,
  { displayName, website, phone }: CompanyDetails,
) {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(companyMembers)
      .where(eq(companyMembers.userId, userId))
      .for("update")
    if (!member || member.status === "rejected") return { updated: false }

    const [verifiedPeer] = await tx
      .select({ userId: companyMembers.userId })
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, member.companyId),
          eq(companyMembers.status, "verified"),
          ne(companyMembers.userId, userId),
        ),
      )
      .limit(1)
    const canEditCompany = member.status === "verified" || !verifiedPeer

    await tx
      .update(companyMembers)
      .set({ phone })
      .where(eq(companyMembers.userId, userId))
    if (canEditCompany) {
      await tx
        .update(companies)
        .set({ displayName, website })
        .where(eq(companies.id, member.companyId))
    }
    return { updated: true, companyUpdated: canEditCompany }
  })
}

// File de vérification de l'admin : les demandes les plus récentes d'abord.
export async function listMembershipsForReview() {
  return db
    .select({
      userId: companyMembers.userId,
      name: user.name,
      email: user.email,
      jobTitle: companyMembers.jobTitle,
      relationship: companyMembers.relationship,
      relationshipDetails: companyMembers.relationshipDetails,
      phone: companyMembers.phone,
      status: companyMembers.status,
      reviewNote: companyMembers.reviewNote,
      reviewedAt: companyMembers.reviewedAt,
      createdAt: companyMembers.createdAt,
      company: {
        legalName: companies.legalName,
        displayName: companies.displayName,
        siren: companies.siren,
        siret: companies.siret,
        nafCode: companies.nafCode,
        nafLabel: companies.nafLabel,
        communeName: companies.communeName,
        website: companies.website,
      },
    })
    .from(companyMembers)
    .innerJoin(user, eq(user.id, companyMembers.userId))
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .orderBy(desc(companyMembers.createdAt))
}

// Applique la décision de l'admin à un rattachement en attente, et à ses annonces en attente,
// dans une même transaction : validées, elles sont publiées ; refusées, elles le sont aussi.
// Renvoie null si le rattachement n'existe pas ou a déjà été décidé.
export async function decideMembership(
  adminId: string,
  decision: MembershipDecision,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const verified = decision.decision === "verify"
    const [member] = await tx
      .update(companyMembers)
      .set({
        status: verified ? "verified" : "rejected",
        reviewNote: verified ? null : decision.reviewNote,
        reviewedAt: now,
        reviewedBy: adminId,
      })
      .where(
        and(
          eq(companyMembers.userId, decision.userId),
          eq(companyMembers.status, "pending"),
        ),
      )
      .returning()
    if (!member) return null

    const pendingOffers = and(
      eq(offers.createdByUserId, member.userId),
      eq(offers.companyId, member.companyId),
      eq(offers.status, "pending_review"),
    )
    const changed = await tx
      .update(offers)
      .set(
        verified
          ? { status: "published", publishedAt: now, validityConfirmedAt: now }
          : { status: "rejected" },
      )
      .where(pendingOffers)
      .returning({ id: offers.id })

    const [details] = await tx
      .select({
        name: user.name,
        email: user.email,
        legalName: companies.legalName,
        displayName: companies.displayName,
      })
      .from(user)
      .innerJoin(companies, eq(companies.id, member.companyId))
      .where(eq(user.id, member.userId))

    return { member, ...details, offerIds: changed.map((offer) => offer.id) }
  })
}
