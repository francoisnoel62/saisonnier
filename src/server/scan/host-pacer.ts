import "server-only"

import { setTimeout } from "node:timers/promises"

import { scanLimits } from "@/domain/scan/limits"

// Partagé par les clients d'un même processus ; le cache robots reste propre à l'étape.
export class HostPacer {
  private hosts = new Map<
    string,
    {
      tail: Promise<void>
      lastRequestAt: number
      retryAt: number
      intervalMs: number
    }
  >()

  defer(host: string, delayMs: number) {
    const state = this.state(host)
    state.retryAt = Math.max(state.retryAt, Date.now() + delayMs)
  }

  private state(host: string) {
    let state = this.hosts.get(host)
    if (!state) {
      state = {
        tail: Promise.resolve(),
        lastRequestAt: 0,
        retryAt: 0,
        intervalMs: 0,
      }
      this.hosts.set(host, state)
    }
    return state
  }

  async run<T>(
    host: string,
    intervalMs: number,
    signal: AbortSignal,
    request: () => Promise<T>,
  ): Promise<T> {
    const state = this.state(host)
    state.intervalMs = Math.max(state.intervalMs, intervalMs)
    const previous = state.tail
    let release!: () => void
    state.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    // Une attente annulée ne libère jamais le verrou du prédécesseur encore actif.
    const turn = previous.then(async () => {
      try {
        signal.throwIfAborted()
        const wait =
          Math.max(state.lastRequestAt + state.intervalMs, state.retryAt) -
          Date.now()
        if (wait > 0)
          await setTimeout(Math.min(wait, 2_147_483_647), undefined, { signal })
        signal.throwIfAborted()
        state.lastRequestAt = Date.now()
        return await request()
      } finally {
        release()
      }
    })
    return abortable(turn, signal)
  }
}

export function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) {
      // Le travail en file peut échouer après notre retour ; sa promesse reste observée.
      void promise.catch(() => {})
      return abort()
    }
    signal.addEventListener("abort", abort, { once: true })
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort))
  })
}

export const scanHostPacer = new HostPacer()
export const defaultHostIntervalMs = scanLimits.minIntervalMs
