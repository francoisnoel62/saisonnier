import type {
  ScanCandidateStatus,
  ScanMode,
  ScanRunSourceStatus,
  ScanRunStatus,
} from "./vocabulary"

export type ScanQueueItem = {
  id: string
  title: string
  companyName: string | null
  location: string | null
  sourceKey: string
  sourceLabel: string
  readyForReviewAt: string
  status: ScanCandidateStatus
  blockingCount: number
  alertCount: number
}
export type ScanSnapshot = {
  run: {
    id: string
    mode: ScanMode
    status: ScanRunStatus
    active: boolean
    startedAt: string
    deadlineAt: string | null
    deliveredCount: number
    targetCount: number | null
    targetReachedAt: string | null
    firstDeliveredAt: string | null
    lastProgressAt: string | null
    finishedAt: string | null
    // Un workflow a pris le passage en charge (sinon « Relancer »).
    orchestrated: boolean
    sources: {
      key: string
      label: string
      revision: number
      status: ScanRunSourceStatus
      listedCount: number
      fetchedCount: number
      deliveredCount: number
      excludedCount: number
      failedCount: number
      requestCount: number
      lastError: string | null
    }[]
  } | null
  counts: {
    toReview: number
    published: number
    rejected: number
    excluded: number
    duplicates: number
    suggestions: number
  }
  items: ScanQueueItem[]
  tracked: ScanQueueItem[]
  nextCursor: string | null
}

// Les mises à jour portent sur la file, jamais sur les props du formulaire ouvert.
export function mergeQueueItems(
  current: ScanQueueItem[],
  incoming: ScanQueueItem[],
  tracked: ScanQueueItem[],
  openedId: string | null,
) {
  const changes = new Map(
    [...incoming, ...tracked].map((item) => [item.id, item]),
  )
  const items = current.flatMap((item) => {
    const next = changes.get(item.id) ?? item
    return next.status === "to_review" || next.id === openedId ? [next] : []
  })
  const known = new Set(items.map((item) => item.id))
  for (const item of [...incoming, ...tracked])
    if (
      !known.has(item.id) &&
      (item.status === "to_review" || item.id === openedId)
    ) {
      items.push(item)
      known.add(item.id)
    }
  return items
}
export function snapshotRetryDelay(failures: number) {
  return Math.min(60_000, 5_000 * 2 ** Math.min(Math.max(0, failures - 1), 4))
}
