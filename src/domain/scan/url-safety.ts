export type ScanUrlPolicy = {
  environment: "development" | "test" | "production"
  testSourceUrl?: string
}

// L'exception locale porte sur une origine explicite, jamais sur tout le réseau local.
export function isTestSourceUrl(url: URL, policy: ScanUrlPolicy) {
  if (policy.environment === "production" || !policy.testSourceUrl) return false
  try {
    const test = new URL(policy.testSourceUrl)
    return (
      test.protocol === "http:" &&
      test.hostname === "localhost" &&
      !test.username &&
      !test.password &&
      url.origin === test.origin
    )
  } catch {
    return false
  }
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
