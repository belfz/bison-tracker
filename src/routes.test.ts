import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createApp, type AppEnv } from "./routes";

async function applySchema(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL,
      feature_count INTEGER NOT NULL,
      raw_hash TEXT NOT NULL
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
      centroid_lat REAL NOT NULL,
      centroid_lon REAL NOT NULL,
      bbox_min_lat REAL NOT NULL,
      bbox_min_lon REAL NOT NULL,
      bbox_max_lat REAL NOT NULL,
      bbox_max_lon REAL NOT NULL,
      num_individuals INTEGER NOT NULL,
      sex TEXT NOT NULL
    )
  `).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_sightings_snapshot ON sightings(snapshot_id)"
  ).run();
}

async function seedData(db: D1Database) {
  await db.prepare(
    "INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)"
  ).bind("2026-02-25T06:00:00Z", 1, "hash1").run();
  await db.prepare(
    "INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)"
  ).bind("2026-02-25T12:00:00Z", 1, "hash2").run();
  await db.prepare(
    `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(1, 52.5, 21.0, 52.4, 20.9, 52.6, 21.1, 3, "f").run();
  await db.prepare(
    `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(2, 53.0, 22.0, 52.9, 21.9, 53.1, 22.1, 5, "f").run();
}

describe("API routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await applySchema(env.DB);
    await seedData(env.DB);
    app = createApp();
  });

  it("GET /api/snapshots returns list of snapshots", async () => {
    const res = await app.request("/api/snapshots", {}, { DB: env.DB } satisfies AppEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].fetched_at).toBe("2026-02-25T12:00:00Z");
  });

  it("GET /api/snapshots/latest returns most recent snapshot with sightings", async () => {
    const res = await app.request("/api/snapshots/latest", {}, { DB: env.DB } satisfies AppEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot.fetched_at).toBe("2026-02-25T12:00:00Z");
    expect(body.sightings).toHaveLength(1);
  });

  it("GET /api/snapshots/:id returns sightings for a snapshot", async () => {
    const res = await app.request("/api/snapshots/1", {}, { DB: env.DB } satisfies AppEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sightings).toHaveLength(1);
    expect(body.sightings[0].num_individuals).toBe(3);
  });

  it("GET /api/snapshots/:id returns 404 for unknown id", async () => {
    const res = await app.request("/api/snapshots/999", {}, { DB: env.DB } satisfies AppEnv);
    expect(res.status).toBe(404);
  });
});
