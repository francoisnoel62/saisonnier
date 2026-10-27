import { scanFailureLabels } from "@/domain/scan/http"
import type { ScanProbeResult } from "@/domain/scan/probe"
import {
  sampleFields,
  type ExtractionSample,
  type SampleField,
} from "@/domain/scan/sample"
import { formatDateTime } from "@/lib/format"

// Résultats de sonde et d'échantillon, affichés dans un panneau ou dans l'onglet « Tests ».
// Ni coordonnées ni texte de page : seulement des mesures et des champs établis.

export function ProbeResultView({ result }: { result: ScanProbeResult }) {
  return (
    <>
      <p className="wrap-anywhere">
        Déploiement : {result.deploymentUrl}
        <br />
        Sonde du {formatDateTime(result.probedAt)}
      </p>
      {result.requests.map((request, index) => (
        <section
          key={`${index}-${request.url}`}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <h3 className="font-medium">
            {request.kind === "list" ? "Liste" : "Fiche"} —{" "}
            {request.ok ? "Accessible" : "Échec"}
          </h3>
          <p className="wrap-anywhere">URL : {request.url}</p>
          {request.pageUrl && (
            <p className="wrap-anywhere">Fiche publique : {request.pageUrl}</p>
          )}
          {request.finalUrl && (
            <p className="wrap-anywhere">URL finale : {request.finalUrl}</p>
          )}
          <p>
            HTTP : {request.status ?? "sans réponse"} · échanges{" "}
            {request.elapsedMs} ms · attente de politesse {request.waitedMs} ms
            ·{" "}
            {request.bytes === undefined
              ? "taille non mesurée"
              : `${request.bytes} octets`}
          </p>
          {request.reason && <p>Motif : {scanFailureLabels[request.reason]}</p>}
          {request.robots.map((robots, index) => (
            <p key={index} className="wrap-anywhere">
              robots.txt :{" "}
              {robots.allowed
                ? "autorisé"
                : robots.reason
                  ? `indisponible (${scanFailureLabels[robots.reason]})`
                  : "interdit"}{" "}
              (HTTP {robots.status ?? "sans réponse"}, délai{" "}
              {robots.crawlDelayMs} ms) — {robots.url}
            </p>
          ))}
          <p>
            JSON-LD JobPosting :{" "}
            {request.jobPosting === "valid"
              ? "présent"
              : request.jobPosting === "invalid_json"
                ? "présent, JSON invalide"
                : "absent"}
          </p>
          <p>
            Éléments RSS : {request.rssItems} · Liens de fiche :{" "}
            {request.postingLinks} · Pagination détectée :{" "}
            {request.pagination ? "oui" : "non"}
          </p>
        </section>
      ))}
    </>
  )
}

export const sampleFieldLabels: Record<SampleField, string> = {
  contract: "Contrat",
  period: "Période",
  locations: "Lieu",
  application: "Candidature",
  salary: "Salaire",
}

export function SampleResultView({ result }: { result: ExtractionSample }) {
  return (
    <>
      <p className="wrap-anywhere">
        Déploiement : {result.deploymentUrl}
        <br />
        {formatDateTime(result.sampledAt)} · {result.extractorVersion}
      </p>
      {result.failure && (
        <p role="alert">Lecture interrompue : {result.failure}</p>
      )}
      <section>
        <h3 className="font-medium">Champs établis dans l’échantillon</h3>
        <ul>
          {sampleFields.map((field) => (
            <li key={field}>
              {sampleFieldLabels[field]} : {result.coverage[field].established}/
              {result.coverage[field].total}
            </li>
          ))}
        </ul>
      </section>
      {result.items.length === 0 && !result.failure && (
        <p>
          Liste vide : l’extraction sera à revérifier dès la première offre.
        </p>
      )}
      {result.items.map((item, index) => (
        <section
          key={`${item.url}-${index}`}
          className="grid gap-2 rounded-lg border p-3"
        >
          <h3 className="font-medium">{item.title}</h3>
          {item.companyName && <p>Employeur : {item.companyName}</p>}
          <a
            className="wrap-anywhere underline"
            href={safeHref(item.url) ?? undefined}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            Fiche source
          </a>
          <dl>
            {sampleFields.map((field) => (
              <div key={field} className="grid gap-1 py-1">
                <dt className="font-medium">{sampleFieldLabels[field]}</dt>
                <dd>{item.fields[field].text}</dd>
              </div>
            ))}
          </dl>
          {item.issues.length > 0 && (
            <ul className="list-inside list-disc text-muted-foreground">
              {item.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}

// Lien externe http(s) seulement, sans identifiants.
export function safeHref(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "")
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
