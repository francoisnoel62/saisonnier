import { adapterCatalog } from "@/domain/scan/adapter-catalog"
import { formatIsoDate } from "@/domain/offer-display"
import type { ScanProbeResult } from "@/domain/scan/probe"
import type { ExtractionSample } from "@/domain/scan/sample"
import type { ScanSourceDraftSnapshot } from "@/domain/scan/source"
import {
  formatCoverage,
  type DiscoveryCoverage,
} from "@/domain/scan/source-health"
import { formatDateTime } from "@/lib/format"

import { ProbeResultView, safeHref, SampleResultView } from "./test-results"

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 border-b py-2 sm:grid-cols-[14rem_1fr]">
      <dt className="font-medium">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </div>
  )
}
function ExternalLink({ href }: { href: string }) {
  const safe = safeHref(href)
  return safe ? (
    <a
      className="underline"
      href={safe}
      target="_blank"
      rel="noreferrer noopener"
    >
      {href}
    </a>
  ) : (
    <>{href}</>
  )
}

// Onglet « Configuration » : connecteur et paramètres ; listes, motif et hôtes déduits (lecture
// seule) ; limites ; lieux connus ; identité ; preuves.
export function SourceConfiguration({
  definition,
  company,
}: {
  definition: ScanSourceDraftSnapshot
  company: { legalName: string; siren: string | null } | null
}) {
  const descriptor = definition.adapter
    ? adapterCatalog[definition.adapter]
    : null
  const params = (definition.adapterParams ?? {}) as Record<string, unknown>
  const limits = definition.limits ?? {}
  const aliases = Object.entries(definition.placeAliases ?? {})
  return (
    <div className="flex min-w-0 flex-col gap-6 text-sm">
      <section>
        <h3 className="mb-2 font-semibold">Connecteur</h3>
        <dl>
          <Row label="Connecteur">
            {descriptor
              ? `${descriptor.label}${descriptor.version ? ` (${descriptor.version})` : ""}`
              : "À déterminer"}
            {descriptor?.unavailableReason && (
              <p className="text-muted-foreground">
                {descriptor.unavailableReason}
              </p>
            )}
          </Row>
          {typeof params.portalUrl === "string" && (
            <Row label="Portail">
              <ExternalLink href={params.portalUrl} />
            </Row>
          )}
          {Array.isArray(params.searchUrls) &&
            params.searchUrls.map((url, index) => (
              <Row key={index} label="Recherche">
                <ExternalLink href={String(url)} />
              </Row>
            ))}
          {typeof params.origin === "string" && (
            <Row label="Origine de test">{params.origin}</Row>
          )}
          <Row label="Listes lues">
            {definition.listUrls?.length ? (
              <ul>
                {definition.listUrls.map((url) => (
                  <li key={url}>
                    <ExternalLink href={url} />
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Motif des fiches">
            <code className="text-xs">
              {definition.postingUrlPattern ?? "—"}
            </code>
          </Row>
          <Row label="Hôtes officiels">
            {definition.officialHosts?.join(", ") || "—"}
          </Row>
          <Row label="Limites de lecture">
            {[
              limits.maxListPages && `${limits.maxListPages} pages de liste`,
              limits.maxPostings && `${limits.maxPostings} fiches`,
              limits.minIntervalMs &&
                `${limits.minIntervalMs} ms entre deux requêtes`,
            ]
              .filter(Boolean)
              .join(" · ") || "Réglages globaux"}
          </Row>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Identité</h3>
        <dl>
          {definition.kind === "discovery" ? (
            <Row label="Employeur">
              Aucun : un diffuseur n’est jamais l’employeur des recrutements.
            </Row>
          ) : (
            <>
              <Row label="Employeur">{definition.employer?.name ?? "—"}</Row>
              <Row label="SIREN">{definition.employer?.siren ?? "—"}</Row>
              <Row label="Site officiel">
                {definition.employerWebsite ? (
                  <ExternalLink href={definition.employerWebsite} />
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Fiche entreprise">
                {company
                  ? `${company.legalName}${company.siren ? ` (SIREN ${company.siren})` : ""}`
                  : "Aucune fiche pour ce SIREN."}
              </Row>
            </>
          )}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Preuves et conditions</h3>
        <dl>
          <Row label="Rattachement">
            {definition.affiliationProof ? (
              <>
                <ExternalLink href={definition.affiliationProof.url} />
                <p>{definition.affiliationProof.note}</p>
                <p className="text-muted-foreground">
                  Consultée le{" "}
                  {formatIsoDate(definition.affiliationProof.checkedAt)}
                </p>
              </>
            ) : (
              "À documenter"
            )}
          </Row>
          <Row label="Conditions de reprise">
            {definition.reuse ? (
              <>
                <ExternalLink href={definition.reuse.url} />
                <p>{definition.reuse.note}</p>
                <p className="whitespace-pre-line">
                  robots.txt : {definition.reuse.robotsExcerpt}
                </p>
                <p className="text-muted-foreground">
                  Consultées le {formatIsoDate(definition.reuse.checkedAt)}
                </p>
              </>
            ) : (
              "À documenter"
            )}
          </Row>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Lieux connus</h3>
        {aliases.length ? (
          <ul className="flex flex-col gap-1">
            {aliases.map(([name, alias]) => (
              <li key={name}>
                « {name} » → {alias.name} ({alias.departmentCode}, INSEE{" "}
                {alias.inseeCode})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Aucun.</p>
        )}
      </section>
    </div>
  )
}

export type SourceTestRow = {
  id: string
  kind: "probed" | "sampled" | "detected"
  createdAt: string
  author: string
  details: {
    configHash?: string
    environment?: string
    deploymentUrl?: string
    draft?: boolean
    status?: "running" | "done" | "failed"
    ok?: boolean
    extractorVersion?: string
    result?: unknown
  }
}

// Onglet « Tests » : sondes, échantillons et détections conservés (20 au plus).
export function SourceTests({
  tests,
  configHash,
}: {
  tests: SourceTestRow[]
  configHash: string
}) {
  if (!tests.length)
    return (
      <p className="text-sm text-muted-foreground">
        Aucun test : lancez « Tester l’accès » ou « Extraire un échantillon ».
      </p>
    )
  return (
    <ol className="flex min-w-0 flex-col gap-3 text-sm">
      {tests.map((test) => (
        <li
          key={test.id}
          className="flex min-w-0 flex-col gap-1 rounded-lg border p-3"
        >
          <h3 className="font-medium">
            {test.kind === "probed"
              ? "Test d’accès"
              : test.kind === "sampled"
                ? "Échantillon"
                : "Détection"}{" "}
            —{" "}
            {test.details.status === "done"
              ? test.details.ok
                ? "réussi"
                : "en échec"
              : test.details.status === "failed"
                ? "interrompu"
                : "en cours"}
          </h3>
          <p className="text-muted-foreground">
            {formatDateTime(test.createdAt)} · {test.author} ·{" "}
            {test.details.environment ?? "local"}
            {test.details.extractorVersion &&
              ` · ${test.details.extractorVersion}`}
          </p>
          <p>
            {test.details.configHash === configHash
              ? "Configuration actuelle"
              : "Ancienne configuration"}
            {test.details.draft && " · réglages non enregistrés"}
          </p>
          {test.details.deploymentUrl && (
            <p className="wrap-anywhere">
              Déploiement : {test.details.deploymentUrl}
            </p>
          )}
          {test.details.result != null && (
            <details>
              <summary className="cursor-pointer">Détail</summary>
              <div className="mt-2 flex flex-col gap-3">
                {test.kind === "probed" ? (
                  <ProbeResultView
                    result={test.details.result as ScanProbeResult}
                  />
                ) : test.kind === "sampled" ? (
                  <SampleResultView
                    result={test.details.result as ExtractionSample}
                  />
                ) : null}
              </div>
            </details>
          )}
        </li>
      ))}
    </ol>
  )
}

// Couverture des employeurs d'une découverte (lot F, SH31), sur 30 jours et par semaine.
export function SourceCoverage({ coverage }: { coverage: DiscoveryCoverage }) {
  return (
    <section
      aria-labelledby="coverage-title"
      className="flex min-w-0 flex-col gap-2 rounded-lg border p-4 text-sm"
    >
      <h3 id="coverage-title" className="font-semibold">
        Radar de la découverte
      </h3>
      <p>{formatCoverage(coverage.last30)}</p>
      {coverage.suggestReserve && (
        <p role="status">
          Plus de 75 % des employeurs sont couverts depuis deux mois : vous
          pouvez passer cette découverte en réserve, ou la limiter au
          remplissage initial. Rien ne change sans votre décision.
        </p>
      )}
      <details>
        <summary className="cursor-pointer">Évolution sur 12 semaines</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-medium">
                Semaine du
              </th>
              <th scope="col" className="py-1 font-medium">
                Couverts
              </th>
              <th scope="col" className="py-1 font-medium">
                Dossiers
              </th>
            </tr>
          </thead>
          <tbody>
            {coverage.weeks.map((week) => (
              <tr key={week.start}>
                <td className="py-1">{formatIsoDate(week.start)}</td>
                <td className="py-1">
                  {week.rate === null
                    ? "—"
                    : `${Math.round(week.rate * 100)} %`}
                </td>
                <td className="py-1">{week.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
