export interface SnapshotInput {
  fetchedAt: string
  featureCount: number
  rawHash: string
}

export interface SightingInput {
  centroidLat: number
  centroidLon: number
  bboxMinLat: number
  bboxMinLon: number
  bboxMaxLat: number
  bboxMaxLon: number
  numIndividuals: number
  sex: string
}

export interface SnapshotRow {
  id: number
  fetched_at: string
  feature_count: number
  raw_hash: string
}

export interface SightingRow {
  id: number
  snapshot_id: number
  centroid_lat: number
  centroid_lon: number
  bbox_min_lat: number
  bbox_min_lon: number
  bbox_max_lat: number
  bbox_max_lon: number
  num_individuals: number
  sex: string
}

export async function findSnapshotByHash(db: D1Database, rawHash: string): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM snapshots WHERE raw_hash = ? LIMIT 1")
    .bind(rawHash)
    .first()
  return result !== null
}

export async function insertSnapshot(db: D1Database, input: SnapshotInput): Promise<number> {
  const result = await db
    .prepare("INSERT INTO snapshots (fetched_at, feature_count, raw_hash) VALUES (?, ?, ?)")
    .bind(input.fetchedAt, input.featureCount, input.rawHash)
    .run()
  return result.meta.last_row_id as number
}

export async function insertSightings(
  db: D1Database,
  snapshotId: number,
  sightings: SightingInput[],
): Promise<void> {
  const stmt = db.prepare(
    `INSERT INTO sightings (snapshot_id, centroid_lat, centroid_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, num_individuals, sex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const batch = sightings.map((s) =>
    stmt.bind(
      snapshotId,
      s.centroidLat,
      s.centroidLon,
      s.bboxMinLat,
      s.bboxMinLon,
      s.bboxMaxLat,
      s.bboxMaxLon,
      s.numIndividuals,
      s.sex,
    ),
  )
  await db.batch(batch)
}

export async function listSnapshots(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<SnapshotRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<SnapshotRow>()
  return results
}

export async function getSightingsBySnapshotId(
  db: D1Database,
  snapshotId: number,
): Promise<SightingRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM sightings WHERE snapshot_id = ?")
    .bind(snapshotId)
    .all<SightingRow>()
  return results
}

export async function getSnapshotById(db: D1Database, id: number): Promise<SnapshotRow | null> {
  const row = await db.prepare("SELECT * FROM snapshots WHERE id = ?").bind(id).first<SnapshotRow>()
  return row ?? null
}

export async function getLatestSnapshot(db: D1Database): Promise<SnapshotRow | null> {
  const row = await db
    .prepare("SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT 1")
    .first<SnapshotRow>()
  return row ?? null
}
