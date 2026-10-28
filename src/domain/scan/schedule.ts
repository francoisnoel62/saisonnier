// Passage quotidien (SH11) : deux crons, 1 h et 2 h UTC ; seul celui qui tombe à 3 h à Paris
// démarre un passage, été comme hiver.
const parisHourFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hourCycle: "h23",
})

export function parisHour(now: Date) {
  return Number(
    parisHourFormat.formatToParts(now).find((part) => part.type === "hour")
      ?.value,
  )
}

export function isDailyScanSlot(now: Date) {
  return parisHour(now) === 3
}
