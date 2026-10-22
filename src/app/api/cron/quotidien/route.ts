import { revalidatePath } from "next/cache"

import { todayInParis } from "@/domain/offer-activity"
import type { DailyJobSummary } from "@/domain/scheduled-job"
import { env } from "@/lib/env"
import { safeEqual } from "@/lib/signed-token"
import { expireOffers } from "@/server/jobs/expire-offers"
import { getScheduledJob, recordDailyJobRun } from "@/server/jobs/settings"
import { sendValidityReminders } from "@/server/jobs/validity-reminders"

// Tâches quotidiennes (§6, plan 16), déclenchées par Vercel Cron à 3 h UTC (vercel.json), qui
// envoie « Authorization: Bearer <CRON_SECRET> ». Sans ce secret, rien ne s'exécute : la route n'a
// pas de session, le secret en tient lieu. Désactivée depuis le tableau de bord de l'admin, la
// tâche répond sans rien exécuter.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 })
  }

  const now = new Date()
  const today = todayInParis(now)
  if (!(await getScheduledJob("daily")).enabled) {
    console.info(
      "[cron quotidien] désactivé depuis l'admin : rien n'est exécuté.",
    )
    return Response.json({ date: today, skipped: "disabled" })
  }

  // D'abord les échéances : une annonce expirée cette nuit ne reçoit pas de rappel.
  const expired = await expireOffers(today, now)
  const reminders = await sendValidityReminders(now)
  const summary: DailyJobSummary = { date: today, expired, reminders }
  await recordDailyJobRun(summary, now)
  console.info(`[cron quotidien] ${JSON.stringify(summary)}`)

  // Statuts et dates de rappel s'affichent dans les espaces employeur et admin.
  revalidatePath("/employeur", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  return Response.json(summary)
}
