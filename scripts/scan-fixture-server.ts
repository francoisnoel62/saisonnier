// Serveur local réservé à Playwright ; aucune dépendance aux portails réels.
import { createServer } from "node:http"

const files = ["posting-1.html", "posting-3.html", "posting-9.html"]
const port = Number(process.env.SCAN_FIXTURE_PORT ?? 3200)
const server = createServer((req, res) => {
  if (req.url === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("User-agent: *\nAllow: /\n")
    return
  }
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(
      `<html><body>${files.map((_file, i) => `<a href="/jobs/${i + 1}">Offre ${i + 1}</a>`).join("")}</body></html>`,
    )
    return
  }
  if (req.url?.startsWith("/carriere")) {
    careerPage(req.url, res)
    return
  }
  const index = Number(req.url?.match(/^\/jobs\/([1-3])$/)?.[1]) - 1
  if (files[index]) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    const year =
      new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 11 ? 1 : 0)
    const title = `Serveur saisonnier fictif ${index + 1} — hiver`
    const description = `Nous recherchons un serveur pour notre établissement de tourisme. CDD saisonnier pour la saison d’hiver du 15 décembre ${year} au 15 avril ${year + 1}. Le poste est à pourvoir. Vous accueillez les clients et assurez le service des repas dans notre restaurant. Logement fourni. Envoyez votre CV à recrutement@employeur.example.`
    const job = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title,
      description: `<p>${description}</p>`,
      datePosted: new Date().toISOString(),
      jobLocation: {
        address: {
          addressLocality: "Chamonix",
          postalCode: "74400",
          addressCountry: "FR",
        },
      },
      directApply: true,
    }
    res.end(
      `<html lang="fr"><body><h1>${title}</h1><p>${description}</p><button>Postuler</button><script type="application/ld+json">${JSON.stringify(job)}</script></body></html>`,
    )
    return
  }
  res.writeHead(404)
  res.end()
})
// Site carrière générique (lot D) : liste paginée (rel="next"), plan de site, fiches avec et
// sans JSON-LD. Contenus fictifs.
const careerPostings = [
  {
    id: 101,
    slug: "serveur",
    title: "Serveur saisonnier fictif",
    jsonLd: true,
  },
  { id: 102, slug: "barman", title: "Barman saisonnier fictif", jsonLd: true },
  {
    id: 103,
    slug: "cuisinier",
    title: "Cuisinier saisonnier fictif",
    jsonLd: true,
  },
  {
    id: 104,
    slug: "plongeur",
    title: "Plongeur saisonnier fictif",
    jsonLd: false,
  },
]
function careerPage(url: string, res: import("node:http").ServerResponse) {
  const html = (body: string) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(`<html lang="fr"><body>${body}</body></html>`)
  }
  const link = (posting: (typeof careerPostings)[number]) =>
    `<a href="/carriere/offres/${posting.slug}-${posting.id}">${posting.title}</a>`
  if (url === "/carriere" || url === "/carriere/")
    return html(
      `<nav><a href="/carriere/contact">Contact</a></nav>${careerPostings.slice(0, 3).map(link).join("")}<a rel="next" href="/carriere?page=2">Suivant</a>`,
    )
  if (url === "/carriere?page=2")
    return html(careerPostings.slice(3).map(link).join(""))
  if (url === "/carriere/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml" })
    res.end(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${careerPostings.map((posting) => `<url><loc>http://localhost:${port}/carriere/offres/${posting.slug}-${posting.id}</loc></url>`).join("")}</urlset>`,
    )
    return
  }
  const posting = careerPostings.find(
    (item) => url === `/carriere/offres/${item.slug}-${item.id}`,
  )
  if (!posting) {
    res.writeHead(404)
    res.end()
    return
  }
  const year =
    new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 11 ? 1 : 0)
  const description = `CDD saisonnier pour la saison d’hiver du 15 décembre ${year} au 15 avril ${year + 1}, dans notre restaurant d’altitude à Chamonix. Logement fourni. Envoyez votre CV à recrutement@employeur.example.`
  const job = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: posting.title,
    description: `<p>${description}</p>`,
    datePosted: new Date().toISOString(),
    jobLocation: {
      address: {
        addressLocality: "Chamonix",
        postalCode: "74400",
        addressCountry: "FR",
      },
    },
  }
  html(
    `<h1>${posting.title}</h1><p>${description}</p>${posting.jsonLd ? `<script type="application/ld+json">${JSON.stringify(job)}</script>` : ""}`,
  )
}

server.listen(port, "127.0.0.1", () =>
  console.log(`Fixtures scan : http://localhost:${port}`),
)
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => server.close())
