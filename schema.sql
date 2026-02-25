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
