import { Hono } from "hono"
import { cors } from "hono/cors"
import {
  listSnapshots,
  getSightingsBySnapshotId,
  getLatestSnapshot,
  getSnapshotById,
  getRecentSnapshotsWithSightings,
} from "./db"

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
