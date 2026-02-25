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
