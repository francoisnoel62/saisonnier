export type ScanUrlPolicy = {
  environment: "development" | "test" | "production"
  testSourceUrl?: string
}

// Seule forme admise pour SCAN_TEST_SOURCE_URL : http://localhost:<port>, sans identifiants.
export function isLocalTestOrigin(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "http:" &&
      url.hostname === "localhost" &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

// L'exception locale porte sur une origine explicite, jamais sur tout le réseau local.
export function isTestSourceUrl(url: URL, policy: ScanUrlPolicy) {
  if (policy.environment === "production" || !policy.testSourceUrl) return false
  return (
    isLocalTestOrigin(policy.testSourceUrl) &&
    url.origin === new URL(policy.testSourceUrl).origin
  )
}

export function checkScanUrl(value: string, policy: ScanUrlPolicy): URL | null {
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (isTestSourceUrl(url, policy)) return url
    if (url.protocol !== "https:" || url.port) return null
    if (
      url.hostname.replace(/\.$/, "") === "localhost" ||
      url.hostname.endsWith(".localhost")
    )
      return null
    return url
  } catch {
    return null
  }
}
