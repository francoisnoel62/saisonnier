import { count, eq, isNull } from "drizzle-orm"
import { afterAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import {
  blockedDomains,
  departments,
  occupations,
  regions,
} from "@/lib/db/schema"

afterAll(() => db.$client.end())

describe("référentiels territoriaux", () => {
  it("contient les 18 régions du COG", async () => {
    const [{ total }] = await db.select({ total: count() }).from(regions)
    expect(total).toBe(18)
  })

  it("contient les 101 départements, Corse et outre-mer compris", async () => {
    const rows = await db.select({ code: departments.code }).from(departments)
    const codes = rows.map((row) => row.code)

    expect(codes).toHaveLength(101)
    expect(codes).toEqual(
      expect.arrayContaining(["2A", "2B", "971", "972", "973", "974", "976"]),
    )
  })

  it("rattache chaque département à une région existante", async () => {
    const orphans = await db
      .select({ code: departments.code })
      .from(departments)
      .leftJoin(regions, eq(departments.regionCode, regions.code))
      .where(isNull(regions.code))

    expect(orphans).toEqual([])
  })
})

describe("référentiels métier", () => {
  it("propose des métiers actifs, chacun dans une famille", async () => {
    const rows = await db.select().from(occupations)

    expect(rows.length).toBeGreaterThanOrEqual(40)
    expect(rows.every((row) => row.isActive && row.family.length > 0)).toBe(
      true,
    )
  })

  it("exclut les job-boards cités au §2, domaines normalisés", async () => {
    const rows = await db
      .select({ domain: blockedDomains.domain })
      .from(blockedDomains)
    const domains = rows.map((row) => row.domain)

    expect(domains).toEqual(
      expect.arrayContaining([
        "indeed.com",
        "francetravail.fr",
        "linkedin.com",
      ]),
    )
    expect(
      domains.every((d) => d === d.toLowerCase() && !d.startsWith("www.")),
    ).toBe(true)
  })
})
