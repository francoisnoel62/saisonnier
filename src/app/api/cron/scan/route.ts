import { revalidatePath } from "next/cache"

import { todayInParis } from "@/domain/offer-activity"
import { isDailyScanSlot } from "@/domain/scan/schedule"
import { env } from "@/lib/env"
import { safeEqual } from "@/lib/signed-token"
import { runScheduledJob } from "@/server/jobs/run"
import { startDailyScan } from "@/server/scan/launch"

// Scan quotidien (plan scan 09, SH11) : deux crons, 1 h et 2 h UTC (vercel.json) ; seul celui qui
// tombe à 3 h à Paris démarre le passage du jour. Secret vérifié comme pour /api/cron/quotidien.
// Le passage s'exécute ensuite en arrière-plan (Vercel Workflow) : la route répond aussitôt.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? ""
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Accès refusé." }, { status: 401 })
  }

  const now = new Date()
  if (!isDailyScanSlot(now))
    return Response.json({ date: todayInParis(now), skipped: "outside_slot" })
  const result = await runScheduledJob("scan", () => startDailyScan(now), now)
  if (!result.ran)
    return Response.json({ date: todayInParis(now), skipped: "disabled" })
  revalidatePath("/admin", "layout")
  return Response.json(result.summary)
}
