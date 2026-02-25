# Bison Tracker

A Cloudflare Worker that scrapes a public GeoJSON API for European bison (żubr) herd locations in Poland every 6 hours and stores parsed sighting data in a Cloudflare D1 database. Provides a REST API for querying historical data.

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (installed via `npm install`)

## Setup

```bash
git clone <repo-url>
cd bison-tracker
npm install
npx wrangler login
```

Create the D1 database:

```bash
npx wrangler d1 create bison-tracker-db
```

Update `database_id` in `wrangler.toml` with the ID from the previous step, then apply the schema:

```bash
npx wrangler d1 execute bison-tracker-db --file=./schema.sql
```

## Local Development

```bash
npm run dev
```

Test the cron trigger locally:

```bash
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

## Tests

```bash
npm test
```

## Deployment

```bash
npm run deploy
```

After deploying, apply the schema to the remote D1 database:

```bash
npx wrangler d1 execute bison-tracker-db --file=./schema.sql --remote
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/snapshots` | List snapshots (paginated) |
| GET | `/api/snapshots/latest` | Most recent snapshot with sightings |
| GET | `/api/snapshots/:id` | Specific snapshot with its sightings |

### Examples

```bash
# List snapshots (limit, offset)
curl "https://your-worker.workers.dev/api/snapshots?limit=10&offset=0"

# Latest snapshot
curl "https://your-worker.workers.dev/api/snapshots/latest"

# Specific snapshot
curl "https://your-worker.workers.dev/api/snapshots/1"
```

## Architecture

Single Cloudflare Worker handling both scheduled scraping (every 6 hours) and API serving. See [docs/plans/2026-02-25-bison-tracker-design.md](docs/plans/2026-02-25-bison-tracker-design.md) for full design.

## Data Source

GeoJSON API: [https://www.zubry.hmcloud.pl/bisonlife/mapa/map_files/gj_public/aktualne_kwadraty.geojson](https://www.zubry.hmcloud.pl/bisonlife/mapa/map_files/gj_public/aktualne_kwadraty.geojson)
