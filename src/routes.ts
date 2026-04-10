import type { Context } from "hono"
import { Hono } from "hono"
import { cors } from "hono/cors"
import {
  listSnapshots,
  getSightingsBySnapshotId,
  getLatestSnapshot,
  getSnapshotById,
  getRecentSnapshotsWithSightings,
  getHeatmapData,
} from "./db"
import { parseGeoJsonFeatures } from "./scraper"
import { GEOJSON_URL } from "./config"

export type AppEnv = { DB: D1Database }

/**
 * Wraps a handler with Cloudflare edge caching.
 * Uses a normalized `keyPath` so that extra/reordered query params
 * can't be used to bust the cache and flood D1.
 * Only successful (2xx) responses are cached.
 */
async function withCache(
  c: Context<{ Bindings: AppEnv }>,
  keyPath: string,
  maxAge: number,
  compute: () => Promise<Response>,
): Promise<Response> {
  const cacheKey = new Request(new URL(keyPath, c.req.url).toString())
  try {
    const hit = await caches.default.match(cacheKey)
    if (hit) return new Response(hit.body, hit)
  } catch {}

  const response = await compute()

  if (response.ok) {
    try {
      const cacheable = new Response(response.clone().body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${maxAge}`,
        },
      })
      c.executionCtx.waitUntil(caches.default.put(cacheKey, cacheable))
    } catch {}
  }

  return response
}

export function createApp() {
  const app = new Hono<{ Bindings: AppEnv }>()

  app.use("/api/*", cors())

  app.get("/api/snapshots", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50)
    const offset = Number(c.req.query("offset") ?? 0)
    return withCache(c, `/api/snapshots?limit=${limit}&offset=${offset}`, 120, async () =>
      c.json(await listSnapshots(c.env.DB, limit, offset)),
    )
  })

  app.get("/api/snapshots/recent", async (c) => {
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50))
    const beforeParam = c.req.query("before")
    const beforeId = beforeParam ? Number(beforeParam) : undefined
    if (beforeParam && (isNaN(beforeId!) || beforeId! <= 0)) {
      return c.json({ error: "Invalid 'before' parameter" }, 400)
    }

    const keyPath = beforeId
      ? `/api/snapshots/recent?limit=${limit}&before=${beforeId}`
      : `/api/snapshots/recent?limit=${limit}`
    return withCache(c, keyPath, 120, async () =>
      c.json(await getRecentSnapshotsWithSightings(c.env.DB, limit, beforeId)),
    )
  })

  app.get("/api/snapshots/live", async (c) => {
    return withCache(c, "/api/snapshots/live", 300, async () => {
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
      return c.json({
        snapshot: {
          id: null,
          fetched_at: new Date().toISOString(),
          feature_count: sightings.length,
          raw_hash: null,
        },
        sightings,
      })
    })
  })

  app.get("/api/heatmap", async (c) => {
    const months = Math.min(24, Math.max(1, Number(c.req.query("months")) || 12))
    return withCache(c, `/api/heatmap?months=${months}`, 21600, async () => {
      const points = await getHeatmapData(c.env.DB, months)
      return c.json({
        points: points.map((p) => ({
          lat: p.centroid_lat,
          lon: p.centroid_lon,
          frequency: p.frequency,
        })),
        months,
        generated_at: new Date().toISOString(),
      })
    })
  })

  app.get("/api/snapshots/latest", async (c) => {
    return withCache(c, "/api/snapshots/latest", 120, async () => {
      const snapshot = await getLatestSnapshot(c.env.DB)
      if (!snapshot) {
        return c.json({ error: "No snapshots found" }, 404)
      }
      const sightings = await getSightingsBySnapshotId(c.env.DB, snapshot.id)
      return c.json({ snapshot, sightings })
    })
  })

  app.get("/api/snapshots/:id", async (c) => {
    const id = Number(c.req.param("id"))
    if (isNaN(id)) {
      return c.json({ error: "Invalid snapshot ID" }, 400)
    }
    return withCache(c, `/api/snapshots/${id}`, 3600, async () => {
      const snapshot = await getSnapshotById(c.env.DB, id)
      if (!snapshot) {
        return c.json({ error: "Snapshot not found" }, 404)
      }
      const sightings = await getSightingsBySnapshotId(c.env.DB, id)
      return c.json({ snapshot, sightings })
    })
  })

  return app
}
