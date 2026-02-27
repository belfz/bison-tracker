import { Hono } from "hono"
import { cors } from "hono/cors"
import {
  listSnapshots,
  getSightingsBySnapshotId,
  getLatestSnapshot,
  getSnapshotById,
  getRecentSnapshotsWithSightings,
} from "./db"
import { parseGeoJsonFeatures } from "./scraper"
import { GEOJSON_URL } from "./config"

export type AppEnv = { DB: D1Database }

export function createApp() {
  const app = new Hono<{ Bindings: AppEnv }>()

  app.use("/api/*", cors())

  app.get("/api/snapshots", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50)
    const offset = Number(c.req.query("offset") ?? 0)
    const snapshots = await listSnapshots(c.env.DB, limit, offset)
    return c.json(snapshots)
  })

  app.get("/api/snapshots/recent", async (c) => {
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50))
    const beforeParam = c.req.query("before")
    const beforeId = beforeParam ? Number(beforeParam) : undefined
    if (beforeParam && (isNaN(beforeId!) || beforeId! <= 0)) {
      return c.json({ error: "Invalid 'before' parameter" }, 400)
    }
    const results = await getRecentSnapshotsWithSightings(c.env.DB, limit, beforeId)
    return c.json(results)
  })

  app.get("/api/snapshots/live", async (c) => {
    const cacheKey = new Request(
      new URL("/api/snapshots/live", c.req.url).toString(),
    )
    try {
      const cached = await caches.default.match(cacheKey)
      if (cached) return new Response(cached.body, cached)
    } catch {
      // Cache API unavailable (e.g. in tests)
    }

    const response = await fetch(GEOJSON_URL)
    if (!response.ok) {
      return c.json({ error: "Upstream API unavailable" }, 502)
    }
    const raw = await response.text()
    const parsed = parseGeoJsonFeatures(raw)
    const sightings = parsed.map((s) => ({
      id: null,
      snapshot_id: null,
      centroid_lat: s.centroidLat,
      centroid_lon: s.centroidLon,
      bbox_min_lat: s.bboxMinLat,
      bbox_min_lon: s.bboxMinLon,
      bbox_max_lat: s.bboxMaxLat,
      bbox_max_lon: s.bboxMaxLon,
      num_individuals: s.numIndividuals,
      sex: s.sex,
    }))
    const body = {
      snapshot: {
        id: null,
        fetched_at: new Date().toISOString(),
        feature_count: sightings.length,
        raw_hash: null,
      },
      sightings,
    }
    try {
      const cacheable = new Response(JSON.stringify(body), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      })
      c.executionCtx.waitUntil(caches.default.put(cacheKey, cacheable))
    } catch {
      // Cache API or executionCtx unavailable
    }
    return c.json(body)
  })

  app.get("/api/snapshots/latest", async (c) => {
    const snapshot = await getLatestSnapshot(c.env.DB)
    if (!snapshot) {
      return c.json({ error: "No snapshots found" }, 404)
    }
    const sightings = await getSightingsBySnapshotId(c.env.DB, snapshot.id)
    return c.json({ snapshot, sightings })
  })

  app.get("/api/snapshots/:id", async (c) => {
    const id = Number(c.req.param("id"))
    if (isNaN(id)) {
      return c.json({ error: "Invalid snapshot ID" }, 400)
    }
    const snapshot = await getSnapshotById(c.env.DB, id)
    if (!snapshot) {
      return c.json({ error: "Snapshot not found" }, 404)
    }
    const sightings = await getSightingsBySnapshotId(c.env.DB, id)
    return c.json({ snapshot, sightings })
  })

  return app
}
