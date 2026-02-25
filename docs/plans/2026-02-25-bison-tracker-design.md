# Bison Tracker — Design Document

## Purpose

Build a historical archive of European bison (żubr) herd locations in Poland by periodically scraping a public GeoJSON API and storing parsed sighting data in a queryable database. The system runs entirely on Cloudflare infrastructure (Workers + D1).

## Data Source

- **URL**: `https://www.zubry.hmcloud.pl/bisonlife/mapa/map_files/gj_public/aktualne_kwadraty.geojson`
- **Method**: HTTP GET
- **Format**: GeoJSON `FeatureCollection` with polygon features representing grid squares where bison have been observed
- **Coordinate system**: EPSG:3857 (Web Mercator), needs conversion to WGS84 for storage
- **Properties per feature**:
  - `ile_osobnikow` — number of individuals
  - `plec` — sex (`f`, `m`, or other)
  - `aktualnosc` — freshness indicator (not stored, excluded from design)
- **Typical response size**: ~4KB, ~17 features

## Architecture

Single Cloudflare Worker handling both scheduled scraping and API serving.

```
┌────────────────────────────────────────────┐
│           Cloudflare Worker                │
│                                            │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ Cron Trigger  │    │  Hono Router     │  │
│  │ (every 6hrs)  │    │  (API endpoints) │  │
│  └──────┬───────┘    └────────┬─────────┘  │
│         │                     │            │
│         ▼                     │            │
│  ┌──────────────┐             │            │
│  │   Scraper    │             │            │
│  │  fetch →     │             │            │
│  │  parse →     │             │            │
│  │  dedup →     │             │            │
│  │  store       │             │            │
│  └──────┬───────┘             │            │
│         │                     │            │
│         ▼                     ▼            │
│  ┌─────────────────────────────────────┐   │
│  │              D1 Database            │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
         ▲
         │ HTTP GET (every 6hrs)
         │
┌────────┴───────────────────┐
│  Public Bison GeoJSON API  │
└────────────────────────────┘
```

### Why a single Worker

- Data volume is tiny (~25K rows/year)
- Scraping logic is a single HTTP GET + JSON parse
- No cost difference between one or two Workers (billing is per-invocation)
- Can be split into separate Workers later if needed

## Data Model

### `snapshots` table

Each row represents one scrape of the API.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing ID |
| `fetched_at` | TEXT | ISO 8601 timestamp of when the scrape occurred |
| `feature_count` | INTEGER | Number of features in this snapshot |
| `raw_hash` | TEXT | SHA-256 hash of the raw response body (deduplication) |

### `sightings` table

Each row represents one grid square from a snapshot.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing ID |
| `snapshot_id` | INTEGER FK | References `snapshots(id)` |
| `centroid_lat` | REAL | Center of grid square, WGS84 latitude |
| `centroid_lon` | REAL | Center of grid square, WGS84 longitude |
| `bbox_min_lat` | REAL | Bounding box south edge, WGS84 |
| `bbox_min_lon` | REAL | Bounding box west edge, WGS84 |
| `bbox_max_lat` | REAL | Bounding box north edge, WGS84 |
| `bbox_max_lon` | REAL | Bounding box east edge, WGS84 |
| `num_individuals` | INTEGER | Number of bison observed |
| `sex` | TEXT | Sex of observed bison |

### Indexes

- `idx_sightings_snapshot` on `sightings(snapshot_id)` — fast lookup of all sightings for a snapshot

### Schema SQL

```sql
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL,
  feature_count INTEGER NOT NULL,
  raw_hash TEXT NOT NULL
);

CREATE TABLE sightings (
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

CREATE INDEX idx_sightings_snapshot ON sightings(snapshot_id);
```

### Deduplication

Before inserting a new snapshot, compute SHA-256 of the raw API response. If a snapshot with the same `raw_hash` already exists, skip the insert entirely.

### Timeline replay

To see all locations at a given moment in time:

```sql
SELECT * FROM sightings WHERE snapshot_id = ?;
```

To find the snapshot closest to a given date:

```sql
SELECT * FROM sightings
WHERE snapshot_id = (
  SELECT id FROM snapshots
  ORDER BY ABS(julianday(fetched_at) - julianday(?))
  LIMIT 1
);
```

## Cron Job Flow

1. Fetch GeoJSON from the API endpoint
2. Compute SHA-256 hash of the raw response
3. Check if `raw_hash` exists in `snapshots` — if yes, skip (no new data)
4. Parse GeoJSON features
5. Convert polygon coordinates from EPSG:3857 to WGS84
6. Compute centroid and bounding box for each grid square
7. Insert one `snapshots` row and batch-insert all `sightings` rows in a single transaction

### Coordinate conversion (EPSG:3857 → WGS84)

Standard inverse Web Mercator formulas using built-in `Math` functions:

- `lon = (x / 20037508.34) * 180`
- `lat = (180 / π) * (2 * atan(exp(y * π / 20037508.34)) - π/2)`

No external library needed.

### Error handling

- Non-200 response from upstream API: log error, skip snapshot
- Invalid JSON: log error, skip snapshot
- D1 write failure: transaction rollback, no partial data stored

## API Endpoints

All responses are JSON. Router: Hono.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/snapshots` | List snapshots (paginated via `?limit=&offset=`) |
| GET | `/api/snapshots/latest` | Most recent snapshot with all its sightings |
| GET | `/api/snapshots/:id` | All sightings for a specific snapshot |
| GET | `/api/sightings?from=...&to=...` | Sightings across a time range, grouped by snapshot |

## Project Structure

```
bison-tracker/
├── src/
│   ├── index.ts          # Worker entry: cron handler + Hono app
│   ├── scraper.ts        # Fetch, parse, deduplicate, store
│   ├── geo.ts            # EPSG:3857 → WGS84 conversion
│   ├── db.ts             # D1 query helpers
│   └── routes.ts         # API route definitions
├── schema.sql            # D1 migration
├── wrangler.toml         # Worker config (cron trigger, D1 binding)
├── package.json
├── tsconfig.json
└── README.md             # Setup, deployment, API docs
```

## Dependencies

- `hono` — lightweight router with Cloudflare Workers bindings
- `wrangler` — Cloudflare CLI (dev dependency)
- No other runtime dependencies

## Deliverables

- Working Cloudflare Worker with cron-triggered scraper
- D1 database with schema migration
- REST API for querying historical data
- README.md with setup, deployment, and API documentation

## Future considerations (out of scope)

- Map visualization UI consuming the API
- Additional API endpoints (e.g., aggregate statistics, heatmaps)
- Alerting when herds appear in specific areas
