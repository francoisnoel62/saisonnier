import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { del, get, put } from "@vercel/blob"

import type { DocumentKind } from "@/domain/candidate-dossier"
import { env } from "@/lib/env"

// Stockage privé des documents des candidats (H11). Aucun document n'a d'URL publique : seul le
// chemin est conservé en base, et la lecture passe par une route qui vérifie le propriétaire.

type DocumentStore = {
  // Enregistre le fichier sous un chemin unique, dérivé de `pathname`, et renvoie ce chemin.
  put(pathname: string, file: File): Promise<string>
  get(pathname: string): Promise<ReadableStream<Uint8Array> | null>
  del(pathname: string): Promise<void>
}

const vercelBlob: DocumentStore = {
  async put(pathname, file) {
    const blob = await put(pathname, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/pdf",
    })
    return blob.pathname
  },
  async get(pathname) {
    const result = await get(pathname, { access: "private" })
    return result?.statusCode === 200 ? result.stream : null
  },
  async del(pathname) {
    await del(pathname)
  },
}

// Disque local, pour l'E2E : un dossier ignoré par git.
const LOCAL_ROOT = path.join(process.cwd(), ".storage")

// Le chemin vient de la base, mais il ne doit jamais sortir du dossier de stockage.
function localPath(pathname: string) {
  const file = path.resolve(LOCAL_ROOT, pathname)
  if (!file.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error(`Chemin de document invalide : ${pathname}`)
  }
  return file
}

const localDisk: DocumentStore = {
  async put(pathname, file) {
    // Même forme que addRandomSuffix : cv-<suffixe>.pdf
    const unique = pathname.replace(
      /\.pdf$/,
      `-${randomUUID().slice(0, 8)}.pdf`,
    )
    const target = localPath(unique)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, Buffer.from(await file.arrayBuffer()))
    return unique
  },
  async get(pathname) {
    try {
      return new Response(await readFile(localPath(pathname))).body
    } catch {
      return null
    }
  },
  async del(pathname) {
    await rm(localPath(pathname), { force: true })
  },
}

const store = () => (env.STORAGE_DRIVER === "local" ? localDisk : vercelBlob)

// candidates/<userId>/<kind>.pdf, suffixé pour que chaque version ait son propre chemin.
export function putPrivateDocument(
  userId: string,
  kind: DocumentKind,
  file: File,
) {
  return store().put(`candidates/${userId}/${kind}.pdf`, file)
}

export function getPrivateDocument(pathname: string) {
  return store().get(pathname)
}

export function deletePrivateDocument(pathname: string) {
  return store().del(pathname)
}
