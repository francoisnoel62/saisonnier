import { z } from "zod"

import { authorizeRoute } from "@/lib/dal"
import { getScanSnapshot } from "@/server/scan/snapshot"

const querySchema = z.object({
  apres: z.string().optional(),
  limite: z.coerce.number().int().min(1).max(50).default(50),
  suivis: z.string().optional(),
  source: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,47}$/)
    .optional(),
})
export async function GET(request: Request) {
  const { denied } = await authorizeRoute("admin")
  if (denied) {
    denied.headers.set("Cache-Control", "no-store")
    return denied
  }
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success)
    return Response.json(
      { error: "Paramètres invalides." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  const trackedIds = parsed.data.suivis?.split(",").filter(Boolean) ?? []
  if (
    trackedIds.length > 50 ||
    trackedIds.some((id) => !z.uuid().safeParse(id).success)
  )
    return Response.json(
      { error: "Dossiers invalides." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  try {
    return Response.json(
      await getScanSnapshot({
        after: parsed.data.apres,
        limit: parsed.data.limite,
        trackedIds,
        source: parsed.data.source,
      }),
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof RangeError)
      return Response.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    throw error
  }
}
