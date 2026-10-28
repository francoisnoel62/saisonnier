// Serveur local des fixtures du scan (Playwright, tests de workflow) ; aucune dépendance aux
// portails réels. Contenus fictifs (.example).
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"

// Deux portails sur la même origine : « / » (source `fixture`) et « /b/ » (seconde source des
// tests de workflow). Chacun liste trois fiches.
const prefixes = ["", "/b"] as const
const postingCount = 3

// Routes de contrôle (plan scan 09) :
// - POST /controle/suspendre?fiche=/jobs/2 : la fiche répond 503 (Retry-After: 2) jusqu'à
//   POST /controle/liberer?fiche=/jobs/2, au plus 60 s ;
// - POST /controle/refuser?prefixe=/b : 403 sur toutes les pages du portail ;
// - POST /controle/reinitialiser.
type Control = {
  suspended: Map<string, number>
  refused: Set<string>
}

export function createScanFixtureServer(port: number) {
  const control: Control = { suspended: new Map(), refused: new Set() }
  const server = createServer((req, res) => handle(req, res, port, control))
  return {
    server,
    listen: () =>
      new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve)),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

function controlRoute(
  url: URL,
  res: ServerResponse,
  control: Control,
): boolean {
  const action = url.pathname.replace(/^\/controle\//, "")
  const fiche = url.searchParams.get("fiche")
  if (action === "suspendre" && fiche)
    control.suspended.set(fiche, Date.now() + 60_000)
  else if (action === "liberer" && fiche) control.suspended.delete(fiche)
  else if (action === "refuser")
    control.refused.add(url.searchParams.get("prefixe") ?? "")
  else if (action === "reinitialiser") {
    control.suspended.clear()
    control.refused.clear()
  } else return false
  res.writeHead(204)
  res.end()
  return true
}

function handle(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
  control: Control,
) {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`)
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("ok")
    return
  }
  if (req.method === "POST" && url.pathname.startsWith("/controle/")) {
    if (!controlRoute(url, res, control)) {
      res.writeHead(404)
      res.end()
    }
    return
  }
  if (url.pathname === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("User-agent: *\nAllow: /\n")
    return
  }
  if (url.pathname.startsWith("/carriere")) {
    careerPage(req.url ?? "/", res, port)
    return
  }
  const prefix = url.pathname.startsWith("/b/") ? "/b" : ""
  if (control.refused.has(prefix)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (url.pathname === `${prefix}/`) {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(
      `<html><body>${Array.from({ length: postingCount }, (_item, i) => `<a href="${prefix}/jobs/${i + 1}">Offre ${i + 1}</a>`).join("")}</body></html>`,
    )
    return
  }
  const match = new RegExp(`^${prefix}/jobs/([1-${postingCount}])$`).exec(
    url.pathname,
  )
  if (!match || !prefixes.includes(prefix)) {
    res.writeHead(404)
    res.end()
    return
  }
  const suspendedUntil = control.suspended.get(url.pathname)
  if (suspendedUntil && suspendedUntil > Date.now()) {
    res.writeHead(503, { "Retry-After": "2" })
    res.end()
    return
  }
  posting(res, Number(match[1]), prefix)
}

function posting(res: ServerResponse, index: number, prefix: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  const year =
    new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 11 ? 1 : 0)
  const role = prefix
    ? "Animateur saisonnier fictif"
    : "Serveur saisonnier fictif"
  const title = `${role} ${index} — hiver`
  const description = `Nous recherchons un ${prefix ? "animateur" : "serveur"} pour notre établissement de tourisme. CDD saisonnier pour la saison d’hiver du 15 décembre ${year} au 15 avril ${year + 1}. Le poste est à pourvoir. Vous accueillez les clients et assurez le service des repas dans notre restaurant. Logement fourni. Envoyez votre CV à recrutement@employeur.example.`
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
}

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
function careerPage(url: string, res: ServerResponse, port: number) {
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
