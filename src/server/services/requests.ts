import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { canViewOffer, type OfferManager } from "@/domain/employer-offer"
import type {
  ServiceRequestInput,
  ServiceRequestStatus,
} from "@/domain/service-request"
import { db } from "@/lib/db"
import { companies, offers, serviceRequests, user } from "@/lib/db/schema"

// Demandes de prestations (§7, H15) : enregistrées, puis traitées à la main par le fondateur.
// L'appelant passe le déposant de la session, jamais une valeur venue de la requête.

export const serviceRequestMessages = {
  offerNotFound:
    "Cette annonce ne fait pas partie des annonces de votre entreprise.",
  notFound: "Cette demande n'existe plus.",
} as const

// Annonces que le déposant peut désigner : celles de son espace (H17).
export async function listRequestableOffers(manager: OfferManager) {
  const rows = await db
    .select({
      id: offers.id,
      title: offers.title,
      origin: offers.origin,
      companyId: offers.companyId,
      createdByUserId: offers.createdByUserId,
      applicationChannel: offers.applicationChannel,
      status: offers.status,
      communeName: offers.communeName,
    })
    .from(offers)
    .where(
      and(
        eq(offers.origin, "deposited"),
        eq(offers.companyId, manager.companyId),
      ),
    )
    .orderBy(desc(offers.createdAt))
  return rows
    .filter((offer) => canViewOffer(manager, offer))
    .map(({ id, title, communeName }) => ({ id, title, communeName }))
}

export async function createServiceRequest(
  manager: OfferManager,
  input: ServiceRequestInput,
) {
  const offer = input.offerId
    ? (await listRequestableOffers(manager)).find(
        (item) => item.id === input.offerId,
      )
    : null
  if (input.offerId && !offer) {
    return { ok: false, message: serviceRequestMessages.offerNotFound } as const
  }
  const [created] = await db
    .insert(serviceRequests)
    .values({
      ...input,
      companyId: manager.companyId,
      requestedByUserId: manager.userId,
    })
    .returning()
  return {
    ok: true,
    request: created,
    offerTitle: offer?.title ?? null,
  } as const
}

const requestColumns = {
  id: serviceRequests.id,
  services: serviceRequests.services,
  scope: serviceRequests.scope,
  scopeDetails: serviceRequests.scopeDetails,
  purchaseFormat: serviceRequests.purchaseFormat,
  message: serviceRequests.message,
  status: serviceRequests.status,
  createdAt: serviceRequests.createdAt,
  updatedAt: serviceRequests.updatedAt,
  offerId: serviceRequests.offerId,
  offerTitle: offers.title,
}

// « Mes demandes » : celles de l'entreprise pour un déposant vérifié, les siennes sinon (H17).
// La note interne du fondateur n'en fait pas partie.
export async function listEmployerServiceRequests(manager: OfferManager) {
  return db
    .select(requestColumns)
    .from(serviceRequests)
    .leftJoin(offers, eq(offers.id, serviceRequests.offerId))
    .where(
      and(
        eq(serviceRequests.companyId, manager.companyId),
        manager.status === "verified"
          ? undefined
          : eq(serviceRequests.requestedByUserId, manager.userId),
      ),
    )
    .orderBy(desc(serviceRequests.createdAt))
}

export type EmployerServiceRequest = Awaited<
  ReturnType<typeof listEmployerServiceRequests>
>[number]

// Boîte du fondateur : toutes les demandes, les plus récentes d'abord.
export async function listServiceRequestsForAdmin() {
  return db
    .select({
      ...requestColumns,
      adminNote: serviceRequests.adminNote,
      offerApplicationChannel: offers.applicationChannel,
      offerHidesCompany: offers.hideCompanyIdentity,
      companyLegalName: companies.legalName,
      companyDisplayName: companies.displayName,
      requesterName: user.name,
      requesterEmail: user.email,
    })
    .from(serviceRequests)
    .innerJoin(companies, eq(companies.id, serviceRequests.companyId))
    .leftJoin(user, eq(user.id, serviceRequests.requestedByUserId))
    .leftJoin(offers, eq(offers.id, serviceRequests.offerId))
    .orderBy(desc(serviceRequests.createdAt))
}

export type AdminServiceRequest = Awaited<
  ReturnType<typeof listServiceRequestsForAdmin>
>[number]

export async function updateServiceRequest(
  id: string,
  {
    status,
    adminNote,
  }: { status: ServiceRequestStatus; adminNote: string | null },
) {
  const [updated] = await db
    .update(serviceRequests)
    .set({ status, adminNote })
    .where(eq(serviceRequests.id, id))
    .returning({ id: serviceRequests.id })
  return !!updated
}
