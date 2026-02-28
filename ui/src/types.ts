export interface Sighting {
  id: number | null
  snapshot_id: number | null
  centroid_lat: number
  centroid_lon: number
  bbox_min_lat: number
  bbox_min_lon: number
  bbox_max_lat: number
  bbox_max_lon: number
  num_individuals: number
  sex: string
}

export interface Snapshot {
  id: number | null
  fetched_at: string
  feature_count: number
  raw_hash: string | null
}

export interface Entry {
  snapshot: Snapshot
  sightings: Sighting[]
}
