export function timeEmoji(hour: number): string {
  if (hour >= 6 && hour < 12) return "🌅"
  if (hour >= 12 && hour < 18) return "☀️"
  if (hour >= 18 && hour < 22) return "🌄"
  return "🌙"
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const text = d.toLocaleDateString("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${timeEmoji(d.getHours())} ${text}`
}
