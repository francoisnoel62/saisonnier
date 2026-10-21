import "server-only"

import { eq } from "drizzle-orm"

import type { ContactDetails, DocumentKind } from "@/domain/candidate-dossier"
import { db } from "@/lib/db"
import { candidateProfiles, user } from "@/lib/db/schema"

// Accès au dossier du candidat (plan 10). Toujours celui de l'utilisateur connecté : l'appelant
// passe l'identifiant de la session, jamais une valeur venue de la requête.

export async function getDossier(userId: string) {
  const [row] = await db
    .select({
      name: user.name,
      email: user.email,
      profile: candidateProfiles,
    })
    .from(user)
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, user.id))
    .where(eq(user.id, userId))
  if (!row) throw new Error(`Utilisateur introuvable : ${userId}`)

  const profile = row.profile
  return {
    name: row.name,
    email: row.email,
    phone: profile?.phone ?? null,
    city: profile?.city ?? null,
    applicationMessage: profile?.applicationMessage ?? null,
    cv: profile?.cvPathname
      ? {
          pathname: profile.cvPathname,
          filename: profile.cvFilename!,
          size: profile.cvSize,
          uploadedAt: profile.cvUploadedAt!,
        }
      : null,
    coverLetter: profile?.coverLetterPathname
      ? {
          pathname: profile.coverLetterPathname,
          filename: profile.coverLetterFilename!,
          size: null,
          uploadedAt: profile.coverLetterUploadedAt!,
        }
      : null,
  }
}

export type Dossier = Awaited<ReturnType<typeof getDossier>>
export type DossierDocument = NonNullable<Dossier["cv"]>

// Colonnes de chaque document.
function documentColumns(
  kind: DocumentKind,
  document: { pathname: string; filename: string; size: number } | null,
) {
  if (kind === "cv") {
    return {
      cvPathname: document?.pathname ?? null,
      cvFilename: document?.filename ?? null,
      cvSize: document?.size ?? null,
      cvUploadedAt: document ? new Date() : null,
    }
  }
  return {
    coverLetterPathname: document?.pathname ?? null,
    coverLetterFilename: document?.filename ?? null,
    coverLetterUploadedAt: document ? new Date() : null,
  }
}

const pathnameColumn = (kind: DocumentKind) =>
  kind === "cv"
    ? candidateProfiles.cvPathname
    : candidateProfiles.coverLetterPathname

// Chemin enregistré pour ce document, ou null.
export async function documentPathname(userId: string, kind: DocumentKind) {
  const [row] = await db
    .select({ pathname: pathnameColumn(kind) })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
  return row?.pathname ?? null
}

// Enregistre (ou retire, avec null) un document ; renvoie le chemin qu'il remplace, à supprimer
// du stockage.
export async function setDocument(
  userId: string,
  kind: DocumentKind,
  document: { pathname: string; filename: string; size: number } | null,
) {
  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ pathname: pathnameColumn(kind) })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId))
      .for("update")
    const columns = documentColumns(kind, document)
    await tx
      .insert(candidateProfiles)
      .values({ userId, ...columns })
      .onConflictDoUpdate({ target: candidateProfiles.userId, set: columns })
    return previous?.pathname ?? null
  })
}

// Nom (sur le compte), téléphone et ville.
export async function saveContactDetails(
  userId: string,
  { name, phone, city }: ContactDetails,
) {
  await db.transaction(async (tx) => {
    await tx.update(user).set({ name }).where(eq(user.id, userId))
    await tx
      .insert(candidateProfiles)
      .values({ userId, phone, city })
      .onConflictDoUpdate({
        target: candidateProfiles.userId,
        set: { phone, city },
      })
  })
}

export async function saveApplicationMessage(
  userId: string,
  applicationMessage: string | null,
) {
  await db
    .insert(candidateProfiles)
    .values({ userId, applicationMessage })
    .onConflictDoUpdate({
      target: candidateProfiles.userId,
      set: { applicationMessage },
    })
}
