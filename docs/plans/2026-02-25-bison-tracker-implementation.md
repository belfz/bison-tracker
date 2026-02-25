# Bison Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Cloudflare Worker that scrapes a public bison herd GeoJSON API every 6 hours, stores parsed sighting data in D1, and serves a query API.

**Architecture:** Single Worker with a cron trigger for scraping and Hono router for API endpoints. D1 for storage. Coordinates converted from EPSG:3857 to WGS84 at ingest time.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, Hono, Vitest with @cloudflare/vitest-pool-workers

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `vitest.config.ts`

**Step 1: Initialize the project**

Run:
```bash
npm init -y
```

**Step 2: Install dependencies**

Run:
```bash
npm install hono
npm install -D wrangler typescript @cloudflare/workers-types vitest @cloudflare/vitest-pool-workers
```

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create `wrangler.toml`**

```toml
name = "bison-tracker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[triggers]
crons = ["0 */6 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "bison-tracker-db"
database_id = "placeholder-replace-after-creation"
```

**Step 5: Create `vitest.config.ts`**

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

**Step 6: Add scripts to `package.json`**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with wrangler, hono, and vitest"
```

---

### Task 2: Coordinate Conversion Utility

**Files:**
- Create: `src/geo.ts`
- Create: `src/geo.test.ts`

**Step 1: Write the failing test**

Create `src/geo.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { epsg3857ToWgs84, computeCentroid, computeBbox } from "./geo";

describe("epsg3857ToWgs84", () => {
  it("converts origin correctly", () => {
    const [lon, lat] = epsg3857ToWgs84(0, 0);
    expect(lon).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it("converts a known point in Poland (Warsaw area)", () => {
    // EPSG:3857 coords for approx 21°E, 52.2°N
    const x = 2337709.3;
    const y = 6848757.7;
    const [lon, lat] = epsg3857ToWgs84(x, y);
    expect(lon).toBeCloseTo(21.0, 0);
    expect(lat).toBeCloseTo(52.2, 0);
  });
});

describe("computeBbox", () => {
  it("computes WGS84 bounding box from EPSG:3857 polygon ring", () => {
    // A small square in EPSG:3857
    const ring: [number, number][] = [
      [2337709, 6848757],
      [2337709, 6852089],
      [2341041, 6852089],
      [2341041, 6848757],
      [2337709, 6848757],
    ];
    const bbox = computeBbox(ring);
    expect(bbox.minLon).toBeCloseTo(21.0, 0);
    expect(bbox.maxLon).toBeCloseTo(21.03, 0);
    expect(bbox.minLat).toBeCloseTo(52.2, 0);
    expect(bbox.maxLat).toBeCloseTo(52.22, 0);
  });
});

describe("computeCentroid", () => {
  it("computes center of bounding box", () => {
    const bbox = { minLat: 52.0, maxLat: 53.0, minLon: 20.0, maxLon: 21.0 };
    const [lat, lon] = computeCentroid(bbox);
    expect(lat).toBeCloseTo(52.5, 5);
    expect(lon).toBeCloseTo(20.5, 5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/geo.test.ts`
Expected: FAIL with "Cannot find module ./geo"

**Step 3: Write minimal implementation**

Create `src/geo.ts`:

```typescript
const EARTH_RADIUS = 6378137;
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS; // 20037508.342789244

export function epsg3857ToWgs84(x: number, y: number): [lon: number, lat: number] {
  const lon = (x / ORIGIN_SHIFT) * 180;
  const lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((y / ORIGIN_SHIFT) * Math.PI)) - Math.PI / 2);
  return [lon, lat];
}

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function computeBbox(ring: [number, number][]): Bbox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [x, y] of ring) {
    const [lon, lat] = epsg3857ToWgs84(x, y);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return { minLat, maxLat, minLon, maxLon };
}

export function computeCentroid(bbox: Bbox): [lat: number, lon: number] {
  return [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLon + bbox.maxLon) / 2];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/geo.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/geo.ts src/geo.test.ts
git commit -m "feat: add EPSG:3857 to WGS84 coordinate conversion"
```

---

### Task 3: D1 Schema Migration

**Files:**
- Create: `schema.sql`

**Step 1: Create the schema file**

Create `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL,
  feature_count INTEGER NOT NULL,
  raw_hash TEXT NOT NULL
);

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
);

CREATE INDEX IF NOT EXISTS idx_sightings_snapshot ON sightings(snapshot_id);
```

**Step 2: Verify the schema is valid SQL**

Run: `sqlite3 :memory: < schema.sql && echo "Schema OK"`
Expected: "Schema OK"

**Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat: add D1 database schema"
```

---

### Task 4: Database Helpers

**Files:**
- Create: `src/db.ts`
- Create: `src/db.test.ts`

**Step 1: Write the failing tests**

Create `src/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { findSnapshotByHash, insertSnapshot, insertSightings, listSnapshots, getSightingsBySnapshotId, getLatestSnapshot } from "./db";

async function applySchema(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL,
      feature_count INTEGER NOT NULL,
      raw_hash TEXT NOT NULL
    );
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
    );
    CREATE INDEX IF NOT EXISTS idx_sightings_snapshot ON sightings(snapshot_id);
  `);
}

describe("db helpers", () => {
  beforeEach(async () => {
    await applySchema(env.DB);
  });

  it("insertSnapshot returns the new snapshot id", async () => {
    const id = await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 5,
      rawHash: "abc123",
    });
    expect(id).toBe(1);
  });

  it("findSnapshotByHash finds existing hash", async () => {
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 5,
      rawHash: "abc123",
    });
    const found = await findSnapshotByHash(env.DB, "abc123");
    expect(found).toBe(true);
  });

  it("findSnapshotByHash returns false for unknown hash", async () => {
    const found = await findSnapshotByHash(env.DB, "unknown");
    expect(found).toBe(false);
  });

  it("insertSightings stores sighting rows", async () => {
    const snapshotId = await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 1,
      rawHash: "hash1",
    });
    await insertSightings(env.DB, snapshotId, [
      {
        centroidLat: 52.5,
        centroidLon: 21.0,
        bboxMinLat: 52.4,
        bboxMinLon: 20.9,
        bboxMaxLat: 52.6,
        bboxMaxLon: 21.1,
        numIndividuals: 3,
        sex: "f",
      },
    ]);
    const sightings = await getSightingsBySnapshotId(env.DB, snapshotId);
    expect(sightings).toHaveLength(1);
    expect(sightings[0].num_individuals).toBe(3);
  });

  it("listSnapshots returns snapshots ordered by fetched_at desc", async () => {
    await insertSnapshot(env.DB, { fetchedAt: "2026-02-25T06:00:00Z", featureCount: 2, rawHash: "h1" });
    await insertSnapshot(env.DB, { fetchedAt: "2026-02-25T12:00:00Z", featureCount: 3, rawHash: "h2" });
    const list = await listSnapshots(env.DB, 10, 0);
    expect(list).toHaveLength(2);
    expect(list[0].fetched_at).toBe("2026-02-25T12:00:00Z");
  });

  it("getLatestSnapshot returns the most recent snapshot", async () => {
    await insertSnapshot(env.DB, { fetchedAt: "2026-02-25T06:00:00Z", featureCount: 2, rawHash: "h1" });
    await insertSnapshot(env.DB, { fetchedAt: "2026-02-25T12:00:00Z", featureCount: 3, rawHash: "h2" });
    const latest = await getLatestSnapshot(env.DB);
    expect(latest).not.toBeNull();
    expect(latest!.fetched_at).toBe("2026-02-25T12:00:00Z");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL with "Cannot find module ./db"

**Step 3: Write minimal implementation**

Create `src/db.ts`:

```typescript
export interface SnapshotInput {
  fetchedAt: string;
  featureCount: number;
  rawHash: string;
}

export interface SightingInput {
  centroidLat: number;
  centroidLon: number;
  bboxMinLat: number;
  bboxMinLon: number;
  bboxMaxLat: number;
  bboxMaxLon: number;
  numIndividuals: number;
  sex: string;
}

export interface SnapshotRow {
  id: number;
  fetched_at: string;
  feature_count: number;
  raw_hash: string;
}

export interface SightingRow {
  id: number;
  snapshot_id: number;
  centroid_lat: number;
  centroid_lon: number;
  bbox_min_lat: number;
  bbox_min_lon: number;
  bbox_max_lat: number;
  bbox_max_lon: number;
  num_individuals: number;
  sex: string;
}

export async function findSnapshotByHash(db: D1Database, rawHash: string): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM snapshots WHERE raw_hash = ? LIMIT 1")
    .bind(rawHash)
    .first();
  return result !== null;
}

export async function insertSnapshot(db: D1Database, input: SnapshotInput): Promise<number> {
  const result = await db
    .prepare("INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)")
    .bind(input.fetchedAt, input.featureCount, input.rawHash)
    .run();
  return result.meta.last_row_id as number;
}

export async function insertSightings(db: D1Database, snapshotId: number, sightings: SightingInput[]): Promise<void> {
  const stmt = db.prepare(
    `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const batch = sightings.map((s) =>
    stmt.bind(snapshotId, s.centroidLat, s.centroidLon, s.bboxMinLat, s.bboxMinLon, s.bboxMaxLat, s.bboxMaxLon, s.numIndividuals, s.sex)
  );
  await db.batch(batch);
}

export async function listSnapshots(db: D1Database, limit: number, offset: number): Promise<SnapshotRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<SnapshotRow>();
  return results;
}

export async function getSightingsBySnapshotId(db: D1Database, snapshotId: number): Promise<SightingRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM sightings WHERE snapshot_id = ?")
    .bind(snapshotId)
    .all<SightingRow>();
  return results;
}

export async function getLatestSnapshot(db: D1Database): Promise<SnapshotRow | null> {
  const row = await db
    .prepare("SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT 1")
    .first<SnapshotRow>();
  return row ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/db.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/db.ts src/db.test.ts
git commit -m "feat: add D1 database helpers"
```

---

### Task 5: Scraper Logic

**Files:**
- Create: `src/scraper.ts`
- Create: `src/scraper.test.ts`

**Step 1: Write the failing tests**

Create `src/scraper.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseGeoJsonFeatures, hashResponse } from "./scraper";

const sampleGeoJson = JSON.stringify({
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::3857" } },
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2337709, 6848757],
            [2337709, 6852089],
            [2341041, 6852089],
            [2341041, 6848757],
            [2337709, 6848757],
          ],
        ],
      },
      properties: {
        aktualnosc: 3,
        ile_osobnikow: 2,
        plec: "f",
      },
    },
  ],
});

describe("parseGeoJsonFeatures", () => {
  it("parses features and converts coordinates to WGS84", () => {
    const sightings = parseGeoJsonFeatures(sampleGeoJson);
    expect(sightings).toHaveLength(1);

    const s = sightings[0];
    expect(s.numIndividuals).toBe(2);
    expect(s.sex).toBe("f");
    expect(s.centroidLat).toBeCloseTo(52.2, 0);
    expect(s.centroidLon).toBeCloseTo(21.0, 0);
    expect(s.bboxMinLat).toBeLessThan(s.bboxMaxLat);
    expect(s.bboxMinLon).toBeLessThan(s.bboxMaxLon);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGeoJsonFeatures("not json")).toThrow();
  });

  it("throws on missing features array", () => {
    expect(() => parseGeoJsonFeatures(JSON.stringify({ type: "FeatureCollection" }))).toThrow();
  });
});

describe("hashResponse", () => {
  it("returns consistent hex SHA-256 hash", async () => {
    const hash1 = await hashResponse("hello world");
    const hash2 = await hashResponse("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hashes for different inputs", async () => {
    const hash1 = await hashResponse("hello");
    const hash2 = await hashResponse("world");
    expect(hash1).not.toBe(hash2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/scraper.test.ts`
Expected: FAIL with "Cannot find module ./scraper"

**Step 3: Write minimal implementation**

Create `src/scraper.ts`:

```typescript
import { computeBbox, computeCentroid, type Bbox } from "./geo";
import type { SightingInput } from "./db";

interface GeoJsonFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number][][];
  };
  properties: {
    aktualnosc: number;
    ile_osobnikow: number;
    plec: string;
  };
}

interface GeoJsonFeatureCollection {
  type: string;
  features: GeoJsonFeature[];
}

export function parseGeoJsonFeatures(raw: string): SightingInput[] {
  const data: GeoJsonFeatureCollection = JSON.parse(raw);
  if (!Array.isArray(data.features)) {
    throw new Error("Invalid GeoJSON: missing features array");
  }

  return data.features.map((feature) => {
    const ring = feature.geometry.coordinates[0] as [number, number][];
    const bbox: Bbox = computeBbox(ring);
    const [centroidLat, centroidLon] = computeCentroid(bbox);

    return {
      centroidLat,
      centroidLon,
      bboxMinLat: bbox.minLat,
      bboxMinLon: bbox.minLon,
      bboxMaxLat: bbox.maxLat,
      bboxMaxLon: bbox.maxLon,
      numIndividuals: feature.properties.ile_osobnikow,
      sex: feature.properties.plec,
    };
  });
}

export async function hashResponse(body: string): Promise<string> {
  const encoded = new TextEncoder().encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/scraper.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/scraper.ts src/scraper.test.ts
git commit -m "feat: add GeoJSON parser and response hashing"
```

---

### Task 6: API Routes

**Files:**
- Create: `src/routes.ts`
- Create: `src/routes.test.ts`

**Step 1: Write the failing tests**

Create `src/routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createApp, type AppEnv } from "./routes";

async function applySchema(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL,
      feature_count INTEGER NOT NULL,
      raw_hash TEXT NOT NULL
    );
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
    );
    CREATE INDEX IF NOT EXISTS idx_sightings_snapshot ON sightings(snapshot_id);
  `);
}

async function seedData(db: D1Database) {
  await db.exec(`
    INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES ('2026-02-25T06:00:00Z', 1, 'hash1');
    INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES ('2026-02-25T12:00:00Z', 1, 'hash2');
    INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
      VALUES (1, 52.5, 21.0, 52.4, 20.9, 52.6, 21.1, 3, 'f');
    INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
      VALUES (2, 53.0, 22.0, 52.9, 21.9, 53.1, 22.1, 5, 'f');
  `);
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes.test.ts`
Expected: FAIL with "Cannot find module ./routes"

**Step 3: Write minimal implementation**

Create `src/routes.ts`:

```typescript
import { Hono } from "hono";
import { listSnapshots, getSightingsBySnapshotId, getLatestSnapshot } from "./db";

export type AppEnv = { DB: D1Database };

export function createApp() {
  const app = new Hono<{ Bindings: AppEnv }>();

  app.get("/api/snapshots", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    const snapshots = await listSnapshots(c.env.DB, limit, offset);
    return c.json(snapshots);
  });

  app.get("/api/snapshots/latest", async (c) => {
    const snapshot = await getLatestSnapshot(c.env.DB);
    if (!snapshot) {
      return c.json({ error: "No snapshots found" }, 404);
    }
    const sightings = await getSightingsBySnapshotId(c.env.DB, snapshot.id);
    return c.json({ snapshot, sightings });
  });

  app.get("/api/snapshots/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid snapshot ID" }, 400);
    }
    const sightings = await getSightingsBySnapshotId(c.env.DB, id);
    if (sightings.length === 0) {
      const snapshot = await getLatestSnapshot(c.env.DB);
      if (!snapshot || snapshot.id !== id) {
        return c.json({ error: "Snapshot not found" }, 404);
      }
    }
    return c.json({ sightings });
  });

  return app;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/routes.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/routes.ts src/routes.test.ts
git commit -m "feat: add API routes for querying snapshots and sightings"
```

---

### Task 7: Worker Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write the Worker entry point**

Create `src/index.ts`:

```typescript
import { createApp, type AppEnv } from "./routes";
import { parseGeoJsonFeatures, hashResponse } from "./scraper";
import { findSnapshotByHash, insertSnapshot, insertSightings } from "./db";

const GEOJSON_URL =
  "https://www.zubry.hmcloud.pl/bisonlife/mapa/map_files/gj_public/aktualne_kwadraty.geojson";

const app = createApp();

async function handleScheduled(env: AppEnv): Promise<void> {
  const response = await fetch(GEOJSON_URL);
  if (!response.ok) {
    console.error(`Fetch failed: ${response.status} ${response.statusText}`);
    return;
  }

  const raw = await response.text();
  const rawHash = await hashResponse(raw);

  const exists = await findSnapshotByHash(env.DB, rawHash);
  if (exists) {
    console.log("Snapshot already exists, skipping");
    return;
  }

  const sightings = parseGeoJsonFeatures(raw);
  const snapshotId = await insertSnapshot(env.DB, {
    fetchedAt: new Date().toISOString(),
    featureCount: sightings.length,
    rawHash,
  });

  await insertSightings(env.DB, snapshotId, sightings);
  console.log(`Stored snapshot ${snapshotId} with ${sightings.length} sightings`);
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: AppEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Worker entry point with cron handler"
```

---

### Task 8: README Documentation

**Files:**
- Create: `README.md`

**Step 1: Write README.md**

Create `README.md` covering:
- Project overview (what and why)
- Prerequisites (Node.js 18+, Cloudflare account, Wrangler CLI)
- Setup instructions:
  1. `npm install`
  2. `npx wrangler login`
  3. Create D1 database: `npx wrangler d1 create bison-tracker-db`
  4. Update `database_id` in `wrangler.toml`
  5. Apply migration: `npx wrangler d1 execute bison-tracker-db --file=./schema.sql`
- Local development: `npm run dev`
- Running tests: `npm test`
- Deployment: `npm run deploy`
- API documentation with example curl commands for each endpoint
- Architecture overview referencing the design doc

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```

---

### Task 9: Local Smoke Test

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Start local dev server**

Run: `npx wrangler dev`
Expected: Server starts, endpoints respond

**Step 3: Test cron trigger locally**

Run: `curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"`
Expected: 200 response, console log shows snapshot stored

**Step 4: Query the API**

Run: `curl "http://localhost:8787/api/snapshots/latest" | python3 -m json.tool`
Expected: JSON response with the snapshot and sightings from step 3

**Step 5: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "chore: final adjustments after smoke test"
```
