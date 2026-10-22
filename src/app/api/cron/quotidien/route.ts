import { revalidatePath } from "next/cache"

import { todayInParis } from "@/domain/offer-activity"
import { env } from "@/lib/env"
import { safeEqual } from "@/lib/signed-token"
import { expireOffers } from "@/server/jobs/expire-offers"
import { sendValidityReminders } from "@/server/jobs/validity-reminders"

// Tâches quotidiennes (§6, plan 16), déclenchées par Vercel Cron à 3 h UTC (vercel.json), qui
// envoie « Authorization: Bearer <CRON_SECRET> ». Sans ce secret, rien ne s'exécute : la route n'a
// pas de session, le secret en tient lieu.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 })
  }

  const now = new Date()
  const today = todayInParis(now)
  // D'abord les échéances : une annonce expirée cette nuit ne reçoit pas de rappel.
  const expired = await expireOffers(today, now)
  const reminders = await sendValidityReminders(now)
  const summary = { date: today, expired, reminders }
  console.info(`[cron quotidien] ${JSON.stringify(summary)}`)

  // Statuts et dates de rappel s'affichent dans les espaces employeur et admin.
  revalidatePath("/employeur", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  return Response.json(summary)
}
