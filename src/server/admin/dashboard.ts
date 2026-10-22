import "server-only"

import { and, count, eq, gte, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { dailySeries, lastDays } from "@/domain/daily-series"
import { db } from "@/lib/db"
import {
  companyMembers,
  contactMessages,
  offers,
  serviceRequests,
  user,
} from "@/lib/db/schema"
import { activeOfferConditions } from "@/server/offers/queries"

// Tableau de bord de l'admin (plan 15) : des comptes réels, aucune donnée de démonstration.

export async function getAdminIndicators(today: string) {
  const [
    deposited,
    collected,
    pendingVerifications,
    newMessages,
    newServiceRequests,
    candidates,
  ] = await Promise.all([
    db.$count(
      offers,
      and(activeOfferConditions(today), eq(offers.origin, "deposited")),
    ),
    db.$count(
      offers,
      and(activeOfferConditions(today), eq(offers.origin, "collected")),
    ),
    db.$count(companyMembers, eq(companyMembers.status, "pending")),
    db.$count(contactMessages, eq(contactMessages.status, "new")),
    db.$count(serviceRequests, eq(serviceRequests.status, "new")),
    db.$count(user, eq(user.role, "candidate")),
  ])
  return {
    deposited,
    collected,
    pendingVerifications,
    newMessages,
    newServiceRequests,
    candidates,
  }
}

// Jour d'un horodatage, à Paris (AAAA-MM-JJ).
const parisDay = (column: AnyPgColumn) =>
  sql<string>`to_char(${column} at time zone 'Europe/Paris', 'YYYY-MM-DD')`

// Inscriptions de candidats et annonces publiées, jour par jour, sur les `days` derniers jours.
export async function getDailyActivity(today: string, days = 90) {
  const period = lastDays(today, days)
  // Une marge d'un jour couvre le décalage horaire ; le regroupement se fait en heure de Paris.
  const since = new Date(Date.parse(`${period[0]}T00:00:00Z`) - 86_400_000)

  const signupDay = parisDay(user.createdAt)
  const publicationDay = parisDay(offers.publishedAt)
  const [signups, publications] = await Promise.all([
    db
      .select({ day: signupDay, value: count() })
      .from(user)
      .where(and(eq(user.role, "candidate"), gte(user.createdAt, since)))
      .groupBy(signupDay),
    db
      .select({ day: publicationDay, value: count() })
      .from(offers)
      .where(gte(offers.publishedAt, since))
      .groupBy(publicationDay),
  ])
  return dailySeries(period, { candidates: signups, offers: publications })
}

export type DailyActivity = Awaited<ReturnType<typeof getDailyActivity>>
