import { revalidatePath } from "next/cache"
import type { NextRequest } from "next/server"

import {
  checkPdfDocument,
  displayFilename,
  documentKindFromSlug,
} from "@/domain/candidate-dossier"
import { authorizeRoute } from "@/lib/dal"
import { setDocument } from "@/server/candidates/dossier"
import {
  deletePrivateDocument,
  putPrivateDocument,
} from "@/server/storage/documents"

const refuse = (error: string, status = 400) =>
  Response.json({ error }, { status })

// Envoi d'un document du dossier : POST /api/dossier/documents?type=cv|lettre, champ « file ».
// Un PDF de 4 Mo au plus, rangé dans le stockage privé ; il remplace le précédent.
export async function POST(request: NextRequest) {
  const { session, denied } = await authorizeRoute("candidate")
  if (denied) return denied

  const kind = documentKindFromSlug(request.nextUrl.searchParams.get("type"))
  if (!kind) return refuse("Type de document inconnu.")

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get("file")
  } catch {
    return refuse("Envoi illisible : choisissez de nouveau votre fichier.")
  }
  if (!(file instanceof File)) return refuse("Aucun fichier reçu.")

  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const problem = checkPdfDocument({ type: file.type, size: file.size, head })
  if (problem) {
    const status = { empty: 400, too_large: 413, not_pdf: 415 }[problem.reason]
    return refuse(problem.message, status)
  }

  const userId = session.user.id
  const pathname = await putPrivateDocument(userId, kind, file)
  const previous = await setDocument(userId, kind, {
    pathname,
    filename: displayFilename(file.name, kind),
    size: file.size,
  })
  // L'ancien fichier n'est plus référencé : son échec de suppression ne bloque pas l'envoi.
  if (previous && previous !== pathname) {
    await deletePrivateDocument(previous).catch((error) =>
      console.error(`Document non supprimé (${previous}) :`, error),
    )
  }

  revalidatePath("/dossier")
  return Response.json({ ok: true }, { status: 201 })
}
