import type { Entry, HeatmapPoint } from "./types"

export const API_BASE = "https://bison-tracker.bison-tracker.workers.dev"
const BATCH_SIZE = 50

export { BATCH_SIZE }

export async function fetchBatch(beforeId?: number): Promise<{
  entries: Entry[]
  allLoaded: boolean
}> {
  const url =
    beforeId != null
      ? `${API_BASE}/api/snapshots/recent?limit=${BATCH_SIZE}&before=${beforeId}`
      : `${API_BASE}/api/snapshots/recent?limit=${BATCH_SIZE}`
  const res = await fetch(url)
  const batch: Entry[] = await res.json()
  return {
    entries: batch,
    allLoaded: batch.length < BATCH_SIZE,
  }
}

export async function fetchLive(): Promise<Entry> {
  const res = await fetch(`${API_BASE}/api/snapshots/live`)
  if (!res.ok) throw new Error("Upstream unavailable")
  return res.json()
}

export async function fetchHeatmap(months = 12): Promise<HeatmapPoint[]> {
  const res = await fetch(`${API_BASE}/api/heatmap?months=${months}`)
  if (!res.ok) throw new Error("Failed to load heatmap data")
  const data: { points: HeatmapPoint[] } = await res.json()
  return data.points
}
