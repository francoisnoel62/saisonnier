import { asc, eq } from "drizzle-orm"

import { site } from "@/config/site"
import type { SearchReferentials } from "@/domain/search-chips"
import { db } from "@/lib/db"
import { departments, occupations, regions } from "@/lib/db/schema"

// Choix proposés par les filtres de la recherche : métiers actifs dans l'ordre du référentiel,
// régions par nom, départements par code.
export async function getSearchReferentials(): Promise<SearchReferentials> {
  const [occupationRows, regionRows, departmentRows] = await Promise.all([
    db
      .select({
        slug: occupations.slug,
        label: occupations.label,
        family: occupations.family,
      })
      .from(occupations)
      .where(eq(occupations.isActive, true))
      .orderBy(asc(occupations.sortOrder), asc(occupations.label)),
    db.select({ code: regions.code, name: regions.name }).from(regions),
    db
      .select({
        code: departments.code,
        name: departments.name,
        regionCode: departments.regionCode,
      })
      .from(departments)
      .orderBy(asc(departments.code)),
  ])

  return {
    occupations: occupationRows,
    // Ordre alphabétique français : « Île-de-France » avant « Normandie ».
    regions: regionRows.sort((a, b) =>
      a.name.localeCompare(b.name, site.locale),
    ),
    departments: departmentRows,
  }
}
