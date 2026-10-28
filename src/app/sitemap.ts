import type { MetadataRoute } from "next"

import { site } from "@/config/site"

// Uniquement les pages publiques : aucune offre n'est indexable (H12).
const paths = ["/", "/contact", "/mentions-legales", "/cgu", "/confidentialite"]

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({ url: new URL(path, site.url).href }))
}
