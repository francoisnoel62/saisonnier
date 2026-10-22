import { FilePlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ScheduledJobsCard } from "@/components/admin/scheduled-jobs-card"
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { SectionCards } from "@/components/dashboard/section-cards"
import { Button } from "@/components/ui/button"
import { todayInParis } from "@/domain/offer-activity"
import { scheduledJobSummaryLabel } from "@/domain/scheduled-job"
import { getAdminIndicators, getDailyActivity } from "@/server/admin/dashboard"
import { listScheduledJobs } from "@/server/jobs/settings"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function AdminHomePage() {
  const today = todayInParis(new Date())
  const [indicators, activity, jobs] = await Promise.all([
    getAdminIndicators(today),
    getDailyActivity(today),
    listScheduledJobs(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild>
          <Link href="/admin/annonces/nouvelle">
            <FilePlusIcon data-icon="inline-start" aria-hidden />
            Saisir une annonce
          </Link>
        </Button>
      </div>
      <SectionCards
        cards={[
          {
            label: "Annonces actives déposées",
            value: indicators.deposited,
            description: "Déposées par les employeurs",
            href: "/admin/annonces",
          },
          {
            label: "Annonces actives collectées",
            value: indicators.collected,
            description: "Reprises des sites officiels",
            href: "/admin/annonces",
          },
          {
            label: "Vérifications en attente",
            value: indicators.pendingVerifications,
            description: "Rattachements à vérifier",
            href: "/admin/verifications",
          },
          {
            label: "Messages non traités",
            value: indicators.newMessages,
            description: "Dans Demandes & messages",
            href: "/admin/demandes",
          },
          {
            label: "Prestations demandées",
            value: indicators.newServiceRequests,
            description: "Nouvelles demandes à traiter",
            href: "/admin/demandes?onglet=prestations",
          },
          {
            label: "Candidats inscrits",
            value: indicators.candidates,
            description: "Comptes candidats créés",
          },
        ]}
      />
      <ChartAreaInteractive data={activity} />
      <ScheduledJobsCard
        jobs={jobs.map((job) => ({
          name: job.name,
          enabled: job.enabled,
          changed: job.enabledChangedAt
            ? { at: job.enabledChangedAt.toISOString(), by: job.updatedByName }
            : null,
          lastRun:
            job.lastRunAt && job.lastSummary
              ? {
                  at: job.lastRunAt.toISOString(),
                  summary: scheduledJobSummaryLabel(job.name, job.lastSummary),
                }
              : null,
        }))}
      />
    </div>
  )
}
