// Serveur local réservé à Playwright ; aucune dépendance aux portails réels.
import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import { resolve } from "node:path"

const directory = resolve("src/server/scan/sources/fixtures/belambra")
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
  const index = Number(req.url?.match(/^\/jobs\/([1-3])$/)?.[1]) - 1
  if (files[index]) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(readFileSync(resolve(directory, files[index])))
    return
  }
  res.writeHead(404)
  res.end()
})
server.listen(port, "127.0.0.1", () =>
  console.log(`Fixtures scan : http://localhost:${port}`),
)
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => server.close())
