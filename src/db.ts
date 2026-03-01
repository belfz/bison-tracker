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

export interface HeatmapRow {
  centroid_lat: number
  centroid_lon: number
  frequency: number
}

export async function getHeatmapData(db: D1Database, months: number): Promise<HeatmapRow[]> {
  const { results } = await db
    .prepare(
      `SELECT centroid_lat, centroid_lon, COUNT(*) as frequency
       FROM sightings
       JOIN snapshots ON snapshots.id = sightings.snapshot_id
       WHERE snapshots.fetched_at >= datetime('now', '-' || ? || ' months')
       GROUP BY centroid_lat, centroid_lon`,
    )
    .bind(months)
    .all<HeatmapRow>()
  return results
}

export interface SnapshotWithSightings {
  snapshot: SnapshotRow
  sightings: SightingRow[]
}

export async function getRecentSnapshotsWithSightings(
  db: D1Database,
  limit: number,
  beforeId?: number,
): Promise<SnapshotWithSightings[]> {
  const snapshotQuery = beforeId
    ? "SELECT * FROM snapshots WHERE id < ? ORDER BY fetched_at DESC LIMIT ?"
    : "SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT ?"

  const { results: snapshots } = beforeId
    ? await db.prepare(snapshotQuery).bind(beforeId, limit).all<SnapshotRow>()
    : await db.prepare(snapshotQuery).bind(limit).all<SnapshotRow>()

  if (snapshots.length === 0) return []

  const ids = snapshots.map((s) => s.id)
  const placeholders = ids.map(() => "?").join(",")
  const { results: allSightings } = await db
    .prepare(`SELECT * FROM sightings WHERE snapshot_id IN (${placeholders})`)
    .bind(...ids)
    .all<SightingRow>()

  const sightingsBySnapshot = new Map<number, SightingRow[]>()
  for (const s of allSightings) {
    const list = sightingsBySnapshot.get(s.snapshot_id) ?? []
    list.push(s)
    sightingsBySnapshot.set(s.snapshot_id, list)
  }

  return snapshots.map((snapshot) => ({
    snapshot,
    sightings: sightingsBySnapshot.get(snapshot.id) ?? [],
  }))
}
