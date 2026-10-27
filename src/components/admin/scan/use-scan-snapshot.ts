"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  mergeQueueItems,
  snapshotRetryDelay,
  type ScanSnapshot,
} from "@/domain/scan/queue"

export function useScanSnapshot({
  initial,
  openedId,
}: {
  initial: ScanSnapshot
  openedId: string | null
}) {
  const [snapshot, setSnapshot] = useState(initial)
  const [items, setItems] = useState(initial.items)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const queue = useRef(initial.items)
  const opened = useRef(openedId)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(true)
  const failures = useRef(0)
  const trackedOffset = useRef(0)
  const last = initial.items.at(-1)
  const cursor = useRef(last ? `${last.readyForReviewAt}|${last.id}` : null)

  const refresh = useCallback(async function refreshSnapshot(): Promise<void> {
    if (
      !active.current ||
      document.visibilityState !== "visible" ||
      controller.current
    )
      return
    if (timer.current) clearTimeout(timer.current)
    const request = new AbortController()
    const startedAt = Date.now()
    controller.current = request
    let delay: number | null = null
    try {
      const ids = queue.current.map((item) => item.id)
      const tracked = ids.slice(
        trackedOffset.current,
        trackedOffset.current + 49,
      )
      trackedOffset.current =
        trackedOffset.current + 49 >= ids.length
          ? 0
          : trackedOffset.current + 49
      if (opened.current) tracked.unshift(opened.current)
      const params = new URLSearchParams({ limite: "50" })
      if (cursor.current) params.set("apres", cursor.current)
      if (tracked.length) params.set("suivis", [...new Set(tracked)].join(","))
      const response = await fetch(`/api/admin/scan/etat?${params}`, {
        cache: "no-store",
        signal: request.signal,
      })
      if (!response.ok) throw new Error("Actualisation impossible")
      const next = (await response.json()) as ScanSnapshot
      if (!active.current || request.signal.aborted) return
      const known = new Set(queue.current.map((item) => item.id))
      const added = next.items.filter((item) => !known.has(item.id)).length
      const merged = mergeQueueItems(
        queue.current,
        next.items,
        next.tracked,
        opened.current,
      )
      queue.current = merged
      setItems(merged)
      setSnapshot(next)
      setError(null)
      if (added)
        setAnnouncement(
          `${added} ${added > 1 ? "nouveaux dossiers" : "nouveau dossier"}`,
        )
      const latest = next.items.at(-1)
      if (latest) cursor.current = `${latest.readyForReviewAt}|${latest.id}`
      failures.current = 0
      delay = next.nextCursor
        ? 0
        : next.run?.active
          ? Math.max(0, 5000 - (Date.now() - startedAt))
          : null
    } catch (error) {
      if (!active.current || request.signal.aborted) return
      void error
      failures.current += 1
      delay = snapshotRetryDelay(failures.current)
      setError(
        `Actualisation interrompue — nouvel essai dans ${delay / 1000} s`,
      )
    } finally {
      if (controller.current === request) controller.current = null
      if (
        active.current &&
        delay !== null &&
        document.visibilityState === "visible"
      )
        timer.current = setTimeout(() => {
          void refreshSnapshot()
        }, delay)
    }
  }, [])
  useEffect(() => {
    opened.current = openedId
    void refresh()
  }, [openedId, refresh])
  useEffect(() => {
    active.current = true
    const resume = () => {
      if (document.visibilityState === "visible") void refresh()
      else if (timer.current) clearTimeout(timer.current)
    }
    document.addEventListener("visibilitychange", resume)
    window.addEventListener("focus", resume)
    void refresh()
    return () => {
      active.current = false
      if (timer.current) clearTimeout(timer.current)
      const stopped = controller.current
      controller.current = null
      stopped?.abort()
      document.removeEventListener("visibilitychange", resume)
      window.removeEventListener("focus", resume)
    }
  }, [refresh])
  return { snapshot, items, error, announcement, refresh }
}
