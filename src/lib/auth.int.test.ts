import { eq, like } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"

// Requêtes HTTP réelles vers la route Better Auth, comme les enverrait un navigateur.
function post(path: string, body: object, cookie?: string) {
  return auth.handler(
    new Request(`${process.env.BETTER_AUTH_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie && { cookie }),
      },
      body: JSON.stringify(body),
    }),
  )
}

const password = "un-mot-de-passe-solide"
const testEmail = (label: string) =>
  `${label}-${crypto.randomUUID()}@auth.int.test`

async function roleOf(email: string) {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.email, email))
  return row?.role
}

afterAll(async () => {
  await db.delete(user).where(like(user.email, "%@auth.int.test"))
  await db.$client.end()
})

describe("rôle à l'inscription", () => {
  it("ignore un rôle envoyé par le client : le compte est candidat", async () => {
    const email = testEmail("intrus")
    const response = await post("/sign-up/email", {
      name: "Intrus",
      email,
      password,
      role: "admin",
    })

    expect(response.status).toBe(200)
    expect(await roleOf(email)).toBe("candidate")
  })

  it("refuse un mot de passe de moins de 10 caractères", async () => {
    const email = testEmail("court")
    const response = await post("/sign-up/email", {
      name: "Court",
      email,
      password: "123456789",
    })

    expect(response.status).toBe(400)
    expect(await roleOf(email)).toBeUndefined()
  })
})

describe("vérification de l'email", () => {
  it("refuse la connexion tant que l'email n'est pas vérifié", async () => {
    const email = testEmail("non-verifie")
    await post("/sign-up/email", { name: "Non vérifié", email, password })

    const response = await post("/sign-in/email", { email, password })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" })
  })
})

describe("modification du rôle", () => {
  it("refuse qu'un utilisateur connecté change son propre rôle", async () => {
    const email = testEmail("candidat")
    await post("/sign-up/email", { name: "Candidat", email, password })
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, email))

    const signIn = await post("/sign-in/email", { email, password })
    expect(signIn.status).toBe(200)
    const cookie = signIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")

    const response = await post("/update-user", { role: "admin" }, cookie)

    expect(response.status).toBe(400)
    expect(await roleOf(email)).toBe("candidate")
  })
})
