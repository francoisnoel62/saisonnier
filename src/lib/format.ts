import { site } from "@/config/site"

const dateTime = new Intl.DateTimeFormat(site.locale, {
  dateStyle: "short",
  timeStyle: "short",
  // Fuseau fixé : le serveur et le navigateur affichent la même heure.
  timeZone: "Europe/Paris",
})

export function formatDateTime(value: Date | string) {
  return dateTime.format(new Date(value))
}

const decimal = new Intl.NumberFormat(site.locale, { maximumFractionDigits: 1 })

// Taille d'un fichier : « 120 Ko », « 3,2 Mo ».
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${decimal.format(bytes / (1024 * 1024))} Mo`
}
