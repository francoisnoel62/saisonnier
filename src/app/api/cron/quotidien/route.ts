import { revalidatePath } from "next/cache"

import { todayInParis } from "@/domain/offer-activity"
import { env } from "@/lib/env"
import { safeEqual } from "@/lib/signed-token"
import { expireOffers } from "@/server/jobs/expire-offers"
import { runScheduledJob } from "@/server/jobs/run"
import { sendValidityReminders } from "@/server/jobs/validity-reminders"

// Tâche quotidienne (§6, plan 16), déclenchée par Vercel Cron à 3 h UTC (vercel.json), qui envoie
// « Authorization: Bearer <CRON_SECRET> ». Sans ce secret, rien ne s'exécute : la route n'a pas de
// session, le secret en tient lieu. Désactivée depuis le tableau de bord de l'admin, la tâche
// répond sans rien exécuter.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 })
  }

  const now = new Date()
  const today = todayInParis(now)
  const result = await runScheduledJob(
    "daily",
    async () => {
      // D'abord les échéances : une annonce expirée cette nuit ne reçoit pas de rappel.
      const expired = await expireOffers(today, now)
      const reminders = await sendValidityReminders(now)
      return { date: today, expired, reminders }
    },
    now,
  )
  if (!result.ran) return Response.json({ date: today, skipped: "disabled" })

  // Statuts et dates de rappel s'affichent dans les espaces employeur et admin.
  revalidatePath("/employeur", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/offres", "layout")
  return Response.json(result.summary)
}
