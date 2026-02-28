import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface Sighting {
  id: number | null
  snapshot_id: number | null
  centroid_lat: number
  centroid_lon: number
  bbox_min_lat: number
  bbox_min_lon: number
  bbox_max_lat: number
  bbox_max_lon: number
  num_individuals: number
  sex: string
}

interface Snapshot {
  id: number | null
  fetched_at: string
  feature_count: number
  raw_hash: string | null
}

interface Entry {
  snapshot: Snapshot
  sightings: Sighting[]
}

const API_BASE = "https://bison-tracker.bison-tracker.workers.dev"
const BATCH_SIZE = 50
const PREFETCH_THRESHOLD = 5

const map = L.map("map").setView([52.8, 16.5], 8)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 18,
}).addTo(map)

const controlsEl = document.getElementById("controls")!
L.DomEvent.disableClickPropagation(controlsEl)
L.DomEvent.disableScrollPropagation(controlsEl)

const entries: Entry[] = []
let currentIndex = 0
const rectangleLayer = L.layerGroup().addTo(map)
let allLoaded = false
let fetching = false

const btnPrev = document.getElementById("btn-prev") as HTMLButtonElement
const btnNext = document.getElementById("btn-next") as HTMLButtonElement
const snapshotDate = document.getElementById("snapshot-date")!
const snapshotMeta = document.getElementById("snapshot-meta")!
const loading = document.getElementById("loading")!
const controls = document.getElementById("controls")!

function timeEmoji(hour: number): string {
  if (hour >= 6 && hour < 12) return "🌅"
  if (hour >= 12 && hour < 18) return "☀️"
  if (hour >= 18 && hour < 22) return "🌄"
  return "🌙"
}

function formatDate(iso: string): string {
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

function updateControls(): void {
  btnPrev.disabled = !(currentIndex < entries.length - 1 || !allLoaded)
  btnNext.disabled = currentIndex <= 0
  const isLive = entries[currentIndex]?.snapshot.id === null
  snapshotDate.classList.toggle("live", isLive)
}

async function fetchBatch(beforeId?: number): Promise<void> {
  if (fetching || allLoaded) return
  fetching = true
  try {
    const url =
      beforeId != null
        ? `${API_BASE}/api/snapshots/recent?limit=${BATCH_SIZE}&before=${beforeId}`
        : `${API_BASE}/api/snapshots/recent?limit=${BATCH_SIZE}`
    const res = await fetch(url)
    const batch: Entry[] = await res.json()
    if (batch.length < BATCH_SIZE) allLoaded = true
    entries.push(...batch)
    updateControls()
  } finally {
    fetching = false
  }
}

function renderSightings(sightings: Sighting[]): void {
  rectangleLayer.clearLayers()

  for (const s of sightings) {
    const bounds: L.LatLngBoundsExpression = [
      [s.bbox_min_lat, s.bbox_min_lon],
      [s.bbox_max_lat, s.bbox_max_lon],
    ]

    const rect = L.rectangle(bounds, {
      color: "#2d6a4f",
      weight: 2,
      fillColor: "#52b788",
      fillOpacity: 0.45,
    })

    const sexLabel = s.sex === "f" ? "Female" : s.sex === "m" ? "Male" : s.sex
    rect.bindPopup(
      `<strong>${s.num_individuals} individual${s.num_individuals !== 1 ? "s" : ""}</strong><br>(${sexLabel})`,
    )

    rectangleLayer.addLayer(rect)
  }
}

async function showSnapshot(index: number): Promise<void> {
  if (index < 0 || index >= entries.length) return
  currentIndex = index
  const { snapshot, sightings } = entries[index]

  if (snapshot.id === null) {
    snapshotDate.textContent = "Live"
    snapshotMeta.textContent = `${sightings.length} sighting${sightings.length !== 1 ? "s" : ""} · just now`
  } else {
    snapshotDate.textContent = formatDate(snapshot.fetched_at)
    snapshotMeta.textContent = `Snapshot #${snapshot.id} · ${snapshot.feature_count} sighting${snapshot.feature_count !== 1 ? "s" : ""}`
  }

  renderSightings(sightings)
  updateControls()

  const remaining = entries.length - 1 - currentIndex
  if (remaining < PREFETCH_THRESHOLD && !allLoaded) {
    const lastStored = [...entries].reverse().find((e) => e.snapshot.id !== null)
    if (lastStored) await fetchBatch(lastStored.snapshot.id!)
  }
}

btnPrev.addEventListener("click", () => showSnapshot(currentIndex + 1))
btnNext.addEventListener("click", () => showSnapshot(currentIndex - 1))

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") btnPrev.click()
  if (e.key === "ArrowRight") btnNext.click()
})

async function init(): Promise<void> {
  try {
    const [liveRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/snapshots/live`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetchBatch(),
    ])

    if (liveRes.status === "fulfilled") {
      entries.unshift(liveRes.value as Entry)
    }

    if (entries.length === 0) {
      loading.textContent = "No data available yet."
      return
    }

    loading.style.display = "none"
    controls.style.display = "flex"
    showSnapshot(0)
  } catch (err) {
    loading.textContent = `Error: ${(err as Error).message}`
  }
}

init()
