"use client"

import { unstable_rethrow, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/form-alert"
import { CompanySearch } from "@/components/company/company-search"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { adapterCatalog } from "@/domain/scan/adapter-catalog"
import type { DetectionProposal } from "@/domain/scan/detection"
import { parseFranceTravailSearchUrl } from "@/domain/scan/france-travail-search"
import { knownPlatformKindLabels } from "@/domain/scan/known-platforms"
import { isTourismActivity } from "@/domain/naf"
import {
  emptySourceFormValues,
  type SourceFormValues,
} from "@/domain/scan/source-form"
import { rejectionReasonBounds } from "@/domain/scan/source-lifecycle"
import {
  scanSourceKindLabels,
  type ScanSourceKind,
} from "@/domain/scan/vocabulary"
import {
  createScanSourceAction,
  detectScanSourceAction,
  searchSourceCompaniesAction,
  transitionScanSourceAction,
} from "@/server/scan/sources/actions"
import type { DetectionReport } from "@/server/scan/sources/detect"

import { safeHref } from "./test-results"

const NONE = "none"

// Valeurs du brouillon depuis la proposition retenue : connecteur et paramètres, ou hôte et
// page documentés quand aucun connecteur ne convient.
function draftValues(
  base: SourceFormValues,
  report: DetectionReport | null,
  proposal: DetectionProposal | null,
): SourceFormValues {
  if (!proposal?.adapter || !report) {
    return report
      ? { ...base, manualHosts: report.host, manualListUrls: report.url }
      : base
  }
  const params = proposal.params ?? {}
  const values: SourceFormValues = { ...base, adapter: proposal.adapter }
  if (typeof params.portalUrl === "string") values.portalUrl = params.portalUrl
  if (typeof params.origin === "string") values.fixtureOrigin = params.origin
  if (typeof params.listUrl === "string") {
    const pagination = params.pagination as { kind?: string } | undefined
    values.careerPage = {
      ...values.careerPage,
      listUrl: params.listUrl,
      postingPattern: String(params.postingPattern ?? ""),
      pagination: pagination?.kind === "next" ? "next" : "none",
    }
  }
  if (Array.isArray(params.searchUrls)) {
    const search = parseFranceTravailSearchUrl(String(params.searchUrls[0]))
    if (search)
      values.search = {
        motsCles: search.motsCles ?? "",
        domaine: search.domaine ?? "",
        typeContrat: search.typeContrat ?? "",
        lieux: search.lieux ?? "",
        rayon: search.rayon ?? "",
        emission: search.emission ?? "",
        offresPartenaires: search.offresPartenaires,
        tri: search.tri ?? "",
      }
  }
  return values
}

function Report({
  report,
  choice,
  onChoose,
}: {
  report: DetectionReport
  choice: string
  onChoose: (value: string) => void
}) {
  const platform = report.knownPlatform
  return (
    <div className="flex flex-col gap-4 text-sm" aria-live="polite">
      <p className="wrap-anywhere">
        {report.read.kind === "skipped"
          ? `Site non lu : ${report.host}.`
          : report.read.ok
            ? `Page lue (HTTP ${report.read.status}) en ${report.read.requests} requête${report.read.requests > 1 ? "s" : ""}.`
            : `Lecture impossible : ${report.read.failure ?? "échec"}.`}
        {report.read.kind === "read" &&
          report.read.robotsAllowed !== null &&
          ` robots.txt : ${report.read.robotsAllowed ? "autorisé" : "interdit"}.`}
      </p>
      {report.read.kind === "read" && report.read.robotsAllowed && (
        <p className="text-muted-foreground">
          Une lecture autorisée par robots.txt ne vaut pas autorisation de
          republier.
        </p>
      )}
      {platform && (
        <section className="rounded-lg border p-3">
          <h3 className="font-medium">
            Plateforme connue : {platform.name} (
            {knownPlatformKindLabels[platform.kind]})
          </h3>
          <p>{platform.conclusion}</p>
          <ul className="mt-1 flex flex-wrap gap-x-3">
            {platform.links.map((link) => {
              const href = safeHref(link.url)
              return (
                <li key={link.url}>
                  {href ? (
                    <a
                      className="underline"
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {link.label}
                    </a>
                  ) : (
                    `${link.label} : ${link.url}`
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {report.blockedDomain && (
        <FormAlert>
          {report.host} relève d’un domaine exclu : job-board, découverte
          seulement.
        </FormAlert>
      )}
      {report.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      <FieldSet>
        <FieldLegend variant="label">Connecteur proposé</FieldLegend>
        <RadioGroup value={choice} onValueChange={onChoose}>
          {report.proposals.map((proposal, index) => (
            <div key={index} className="flex items-start gap-2">
              <RadioGroupItem value={String(index)} id={`proposal-${index}`} />
              <Label
                htmlFor={`proposal-${index}`}
                className="flex flex-col items-start gap-1"
              >
                <span>
                  {proposal.label}
                  {proposal.adapter &&
                    ` — ${adapterCatalog[proposal.adapter].label}`}{" "}
                  ({scanSourceKindLabels[proposal.kind]})
                </span>
                <span className="font-normal text-muted-foreground">
                  {proposal.evidence.join(" ")}
                </span>
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value={NONE} id="proposal-none" />
            <Label htmlFor="proposal-none">
              Aucun connecteur (source à documenter ou à écarter)
            </Label>
          </div>
        </RadioGroup>
      </FieldSet>
    </div>
  )
}

// Assistant d'ajout (§11.4) : point de départ, rapport de détection, type et identité, puis
// création du brouillon ; la page de modification guide la suite.
export function SourceWizard() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [report, setReport] = useState<DetectionReport | null>(null)
  const [withoutUrl, setWithoutUrl] = useState(false)
  const [choice, setChoice] = useState(NONE)
  const [kind, setKind] = useState<ScanSourceKind>("employer")
  const [label, setLabel] = useState("")
  const [employerName, setEmployerName] = useState("")
  const [siren, setSiren] = useState("")
  const [website, setWebsite] = useState("")
  const [host, setHost] = useState("")
  const [nafWarning, setNafWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const proposal =
    report && choice !== NONE
      ? (report.proposals[Number(choice)] ?? null)
      : null
  function choose(value: string, from = report) {
    setChoice(value)
    const next = from && value !== NONE ? from.proposals[Number(value)] : null
    if (next) setKind(next.kind)
  }
  function analyse(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await detectScanSourceAction(url)
        if (!result.ok) {
          setError(result.message)
          return
        }
        const detected = result.report
        setReport(detected)
        setWithoutUrl(false)
        choose(detected.proposals.length ? "0" : NONE, detected)
        if (!detected.proposals.length && detected.blockedDomain)
          setKind("discovery")
        setLabel(detected.knownPlatform?.name ?? detected.host)
        setHost(detected.host)
      } catch (error) {
        unstable_rethrow(error)
        setError("L’analyse n’a pas abouti. Réessayez dans un instant.")
      }
    })
  }
  function values(): SourceFormValues {
    const base: SourceFormValues = {
      ...emptySourceFormValues(kind),
      label,
      ...(kind === "employer"
        ? {
            employerName,
            employerSiren: siren,
            employerWebsite: website,
          }
        : {}),
      manualHosts: host,
    }
    return draftValues(base, report, proposal)
  }
  function create(reject = false) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createScanSourceAction(values())
        if (!result.ok) {
          const fields =
            "fieldErrors" in result && result.fieldErrors
              ? Object.values(result.fieldErrors).flat()
              : []
          setError([result.message, ...fields].join(" "))
          return
        }
        if (reject && report?.knownPlatform) {
          const reason = report.knownPlatform.conclusion.slice(
            0,
            rejectionReasonBounds.max,
          )
          const rejected = await transitionScanSourceAction(
            result.key,
            result.version,
            "reject",
            { reason },
          )
          if (!rejected.ok) toast.error(rejected.message)
          router.push(`/admin/scan/sources/${result.key}`)
          return
        }
        toast.success("Brouillon créé : complétez sa configuration.")
        router.push(`/admin/scan/sources/${result.key}/modifier`)
      } catch (error) {
        unstable_rethrow(error)
        setError("La création n’a pas abouti. Votre saisie est conservée.")
      }
    })
  }

  const ready = report !== null || withoutUrl
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>1. Point de départ</h2>
          </CardTitle>
          <CardDescription>
            Adresse du portail carrière, d’une page d’offres ou d’une recherche
            France Travail. Deux requêtes au plus, robots.txt respecté ; Indeed
            et LinkedIn ne sont jamais lus.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={analyse}>
            <Label htmlFor="start-url" className="sr-only">
              Adresse de départ
            </Label>
            <Input
              id="start-url"
              type="url"
              placeholder="https://recrute.exemple.fr"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={2048}
            />
            <Button type="submit" disabled={pending || !url.trim()}>
              Analyser
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => {
              setReport(null)
              setWithoutUrl(true)
              setChoice(NONE)
            }}
          >
            Enregistrer sans URL
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>2. Ce que nous avons trouvé</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Report report={report} choice={choice} onChoose={choose} />
          </CardContent>
        </Card>
      )}

      {ready && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>3. Type et identité</h2>
            </CardTitle>
            <CardDescription>
              Un job-board n’est qu’une découverte : jamais d’employeur, jamais
              de publication automatique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Type</FieldLegend>
                <RadioGroup
                  value={kind}
                  onValueChange={(value) => setKind(value as ScanSourceKind)}
                >
                  {(["employer", "discovery"] as const).map((value) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={value}
                        id={`wizard-kind-${value}`}
                      />
                      <Label htmlFor={`wizard-kind-${value}`}>
                        {scanSourceKindLabels[value]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="wizard-label">Libellé</FieldLabel>
                <Input
                  id="wizard-label"
                  value={label}
                  maxLength={80}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              {kind === "employer" && (
                <>
                  <CompanySearch
                    title="Retrouver l’employeur dans l’annuaire"
                    unavailable="L’annuaire est momentanément indisponible : saisissez l’employeur à la main."
                    search={searchSourceCompaniesAction}
                    onChoose={(suggestion) => {
                      setEmployerName(
                        suggestion.displayName ?? suggestion.legalName,
                      )
                      setSiren(suggestion.siren)
                      if (!label)
                        setLabel(suggestion.displayName ?? suggestion.legalName)
                      setNafWarning(
                        suggestion.nafCode &&
                          !isTourismActivity(suggestion.nafCode)
                          ? `Code NAF ${suggestion.nafCode} hors du tourisme et des loisirs : vérifiez le périmètre.`
                          : null,
                      )
                    }}
                  />
                  {nafWarning && <FormAlert>{nafWarning}</FormAlert>}
                  <Field>
                    <FieldLabel htmlFor="wizard-employer">Employeur</FieldLabel>
                    <Input
                      id="wizard-employer"
                      value={employerName}
                      maxLength={200}
                      onChange={(event) => setEmployerName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="wizard-siren">
                      SIREN (conseillé)
                    </FieldLabel>
                    <Input
                      id="wizard-siren"
                      inputMode="numeric"
                      value={siren}
                      onChange={(event) => setSiren(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="wizard-website">
                      Site officiel de l’employeur
                    </FieldLabel>
                    <Input
                      id="wizard-website"
                      type="url"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                    />
                  </Field>
                </>
              )}
              {!proposal?.adapter && (
                <Field>
                  <FieldLabel htmlFor="wizard-host">Hôte officiel</FieldLabel>
                  <Input
                    id="wizard-host"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    aria-describedby="wizard-host-hint"
                  />
                  <FieldDescription id="wizard-host-hint">
                    En minuscules, sans port ni chemin. Un hôte appartient à une
                    seule source.
                  </FieldDescription>
                </Field>
              )}
              {error && <FormAlert>{error}</FormAlert>}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full sm:w-fit"
                  disabled={pending || !label.trim()}
                  onClick={() => create()}
                >
                  Créer le brouillon
                </Button>
                {report?.read.kind === "skipped" && report.knownPlatform && (
                  <Button
                    variant="outline"
                    className="w-full sm:w-fit"
                    disabled={pending || !label.trim()}
                    onClick={() => create(true)}
                  >
                    Enregistrer comme écartée
                  </Button>
                )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
