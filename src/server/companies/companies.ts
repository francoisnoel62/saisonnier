import "server-only"

import { asc, eq } from "drizzle-orm"

import type { CompanyFile } from "@/domain/membership"
import { db } from "@/lib/db"
import { companies } from "@/lib/db/schema"

// Fiches entreprise du back-office (plan 15) : l'admin choisit l'entreprise d'une annonce, ou
// crée la fiche d'une entreprise qui n'a pas de compte.

export type CompanyOption = {
  id: string
  legalName: string
  displayName: string | null
  siren: string | null
  communeName: string | null
}

const optionColumns = {
  id: companies.id,
  legalName: companies.legalName,
  displayName: companies.displayName,
  siren: companies.siren,
  communeName: companies.communeName,
}

export async function listCompanyOptions(): Promise<CompanyOption[]> {
  return db
    .select(optionColumns)
    .from(companies)
    .orderBy(asc(companies.legalName), asc(companies.id))
}

export async function companyExists(companyId: string) {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
  return !!row
}

// Une entreprise déjà connue par son SIREN est reprise telle quelle, sans doublon ni modification.
export async function createCompanyFile(file: CompanyFile) {
  const [created] = await db
    .insert(companies)
    .values(file)
    .onConflictDoNothing({ target: companies.siren })
    .returning(optionColumns)
  if (created) return { company: created, existing: false }

  const [existing] = await db
    .select(optionColumns)
    .from(companies)
    .where(eq(companies.siren, file.siren!))
  return { company: existing, existing: true }
}
