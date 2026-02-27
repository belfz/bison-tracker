import { describe, it, expect, beforeEach } from "vitest"
import { env } from "cloudflare:test"
import { createApp, type AppEnv } from "./routes"
import { applySchema } from "./test-utils"

async function seedData(db: D1Database) {
  await db
    .prepare("INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)")
    .bind("2026-02-25T06:00:00Z", 1, "hash1")
    .run()
  await db
    .prepare("INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)")
    .bind("2026-02-25T12:00:00Z", 1, "hash2")
    .run()
  await db
    .prepare(
      `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(1, 52.5, 21.0, 52.4, 20.9, 52.6, 21.1, 3, "f")
    .run()
  await db
    .prepare(
      `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(2, 53.0, 22.0, 52.9, 21.9, 53.1, 22.1, 5, "f")
    .run()
}

describe("API routes", () => {
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    await applySchema(env.DB)
    await seedData(env.DB)
    app = createApp()
  })

  it("GET /api/snapshots returns list of snapshots", async () => {
    const res = await app.request("/api/snapshots", {}, { DB: env.DB } satisfies AppEnv)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].fetched_at).toBe("2026-02-25T12:00:00Z")
  })

  it("GET /api/snapshots/latest returns most recent snapshot with sightings", async () => {
    const res = await app.request("/api/snapshots/latest", {}, { DB: env.DB } satisfies AppEnv)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.snapshot.fetched_at).toBe("2026-02-25T12:00:00Z")
    expect(body.sightings).toHaveLength(1)
  })

  it("GET /api/snapshots/:id returns sightings for a snapshot", async () => {
    const res = await app.request("/api/snapshots/1", {}, { DB: env.DB } satisfies AppEnv)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.sightings).toHaveLength(1)
    expect(body.sightings[0].num_individuals).toBe(3)
  })

  it("GET /api/snapshots/:id returns 404 for unknown id", async () => {
    const res = await app.request("/api/snapshots/999", {}, { DB: env.DB } satisfies AppEnv)
    expect(res.status).toBe(404)
  })

  it("GET /api/snapshots/recent returns snapshots with sightings", async () => {
    const res = await app.request("/api/snapshots/recent", {}, { DB: env.DB } satisfies AppEnv)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].snapshot.fetched_at).toBe("2026-02-25T12:00:00Z")
    expect(body[0].sightings).toHaveLength(1)
    expect(body[1].snapshot.fetched_at).toBe("2026-02-25T06:00:00Z")
    expect(body[1].sightings).toHaveLength(1)
  })

  it("GET /api/snapshots/recent?before= paginates correctly", async () => {
    const res = await app.request("/api/snapshots/recent?before=2", {}, {
      DB: env.DB,
    } satisfies AppEnv)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].snapshot.id).toBe(1)
  })
})
