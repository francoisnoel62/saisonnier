import { createHash } from "node:crypto"

import { sourceFingerprint } from "@/domain/scan/source"

// D4 : empreinte de ce qu'une configuration lit (`config_hash`). Sans « server-only » : les
// graines de test (src/test/scan-sources.ts) la calculent aussi hors de Next.
export function sourceConfigHash(
  snapshot: Parameters<typeof sourceFingerprint>[0],
) {
  return createHash("sha256").update(sourceFingerprint(snapshot)).digest("hex")
}
