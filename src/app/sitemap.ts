import type { MetadataRoute } from "next"

import { env } from "@/lib/env"

// Uniquement les pages publiques : aucune offre n'est indexable (H12).
const paths = ["/", "/contact", "/mentions-legales", "/cgu", "/confidentialite"]

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({ url: new URL(path, env.BETTER_AUTH_URL).href }))
}
