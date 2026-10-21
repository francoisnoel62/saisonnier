import "server-only"

import { eq } from "drizzle-orm"

import {
  applicationContacts,
  recruiterIntroduction,
  type ApplicationContacts,
} from "@/domain/application"
import {
  dossierStatus,
  type DossierRequirement,
} from "@/domain/candidate-dossier"
import { isActive, todayInParis } from "@/domain/offer-activity"
import type { Role } from "@/domain/roles"
import { db } from "@/lib/db"
import { blockedDomains, offers } from "@/lib/db/schema"
import { getDossier } from "@/server/candidates/dossier"

export type ApplicationDetails =
  // Offre retirée ou échue : aucune coordonnée.
  | { status: "inactive" }
  // Dossier incomplet (H3) : les coordonnées ne quittent pas le serveur.
  | { status: "incomplete"; missing: DossierRequirement[] }
  | {
      status: "open"
      // Canal « chargé de recrutement » : à qui s'adresse la candidature.
      recruiter: string | null
      contacts: Omit<ApplicationContacts, "blocked">
      // L'admin voit les coordonnées pour la modération ; il n'a pas de CV.
      forAdmin: boolean
    }

export async function getBlockedDomains() {
  const rows = await db
    .select({ domain: blockedDomains.domain })
    .from(blockedDomains)
  return rows.map((row) => row.domain)
}

// Ce que le panneau de candidature d'une offre montre à cet utilisateur. Les coordonnées ne sont
// lues et renvoyées que pour un dossier complet, ou pour l'admin.
export async function getApplicationDetails(
  offerId: string,
  viewer: { id: string; role: Role; name: string },
): Promise<ApplicationDetails> {
  const offer = await db.query.offers.findFirst({
    where: eq(offers.id, offerId),
    columns: {
      title: true,
      status: true,
      applicationDeadline: true,
      endDate: true,
      applicationChannel: true,
      applyEmail: true,
      applyPhone: true,
      applyUrl: true,
      recruiterName: true,
      hideCompanyIdentity: true,
    },
    with: { company: { columns: { legalName: true, displayName: true } } },
  })
  const forAdmin = viewer.role === "admin"
  if (!offer) return { status: "inactive" }
  if (!forAdmin && !isActive(offer, todayInParis(new Date()))) {
    return { status: "inactive" }
  }

  let candidate = { name: viewer.name, message: null as string | null }
  if (!forAdmin) {
    const dossier = await getDossier(viewer.id)
    const { complete, missing } = dossierStatus({
      name: dossier.name,
      phone: dossier.phone,
      cvPathname: dossier.cv?.pathname,
    })
    if (!complete) return { status: "incomplete", missing }
    candidate = { name: dossier.name, message: dossier.applicationMessage }
  }

  const { blocked, ...contacts } = applicationContacts(offer, {
    blockedDomains: await getBlockedDomains(),
    candidateName: candidate.name,
    message: candidate.message,
  })
  // Une destination exclue sur une offre en ligne est un incident : on le journalise.
  for (const target of blocked) {
    console.error(
      `[candidature] Offre ${offerId} : ${target.field} mène à ${target.host}, domaine exclu (${target.domain}). Lien masqué.`,
    )
  }

  return {
    status: "open",
    recruiter:
      offer.applicationChannel === "recruiter"
        ? recruiterIntroduction(offer)
        : null,
    contacts,
    forAdmin,
  }
}
