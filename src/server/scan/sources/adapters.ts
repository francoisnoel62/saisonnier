import "server-only"

import type { AdapterKind, ScanAdapter } from "./adapter"
import { factorialAdapter } from "./factorial"
import { fixtureAdapter } from "./fixture"
import { franceTravailAdapter } from "./france-travail"
import { teamtailorAdapter } from "./teamtailor"

export function scanAdapter(kind: AdapterKind): ScanAdapter | null {
  switch (kind) {
    case "teamtailor":
      return teamtailorAdapter
    case "factorial":
      return factorialAdapter
    case "france-travail":
      return franceTravailAdapter
    case "fixture":
      return fixtureAdapter()
    // Source écartée au plan 01 (robots.txt) : aucun appel à l'API SmartRecruiters.
    case "smartrecruiters":
      return null
  }
}
