import { documentKindFromSlug } from "@/domain/candidate-dossier"
import { authorizeRoute } from "@/lib/dal"
import { getDossier } from "@/server/candidates/dossier"
import { getPrivateDocument } from "@/server/storage/documents"

const notFound = () =>
  Response.json({ error: "Document introuvable." }, { status: 404 })

// Nom de fichier pour Content-Disposition : ASCII de repli, puis le nom exact (RFC 6266).
function attachment(filename: string) {
  const ascii = filename
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
  return `attachment; filename="${ascii || "document.pdf"}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

// Téléchargement d'un document du dossier : GET /api/dossier/documents/cv|lettre. Seul son
// propriétaire y accède (H11) : le chemin est lu en base pour l'utilisateur connecté, jamais dans
// l'URL. Ni l'admin ni un employeur n'y ont accès.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/dossier/documents/[type]">,
) {
  const { session, denied } = await authorizeRoute("candidate")
  if (denied) return denied

  const kind = documentKindFromSlug((await params).type)
  if (!kind) return notFound()

  const dossier = await getDossier(session.user.id)
  const document = kind === "cv" ? dossier.cv : dossier.coverLetter
  if (!document) return notFound()

  const stream = await getPrivateDocument(document.pathname)
  if (!stream) return notFound()

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachment(document.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
