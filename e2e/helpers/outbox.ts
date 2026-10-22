import { readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"

import { expect } from "@playwright/test"

// Sans clé Resend, le serveur de test affiche chaque email en console et en dépose une copie ici
// (EMAIL_OUTBOX_DIR, voir src/lib/email/send.ts).
export const OUTBOX_DIR = ".e2e-outbox"

type SentEmail = { to: string; subject: string; text: string }

export async function clearOutbox() {
  await rm(OUTBOX_DIR, { recursive: true, force: true })
}

async function sentEmails(): Promise<SentEmail[]> {
  const files = await readdir(OUTBOX_DIR).catch(() => [])
  return Promise.all(
    files
      .sort()
      .map(async (file) =>
        JSON.parse(await readFile(path.join(OUTBOX_DIR, file), "utf-8")),
      ),
  )
}

// Dernier email envoyé à cette adresse dont l'objet correspond ; attend qu'il arrive.
export async function expectEmail(to: string, subject: string | RegExp) {
  const matches = (email: SentEmail) =>
    email.to === to &&
    (typeof subject === "string"
      ? email.subject === subject
      : subject.test(email.subject))
  let found: SentEmail | undefined
  await expect
    .poll(
      async () => {
        found = (await sentEmails()).findLast(matches)
        return !!found
      },
      { message: `email « ${subject} » à ${to}` },
    )
    .toBe(true)
  return found!
}
