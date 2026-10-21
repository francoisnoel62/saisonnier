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
