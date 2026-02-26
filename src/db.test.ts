import { describe, it, expect, beforeEach } from "vitest"
import { env } from "cloudflare:test"
import {
  findSnapshotByHash,
  insertSnapshot,
  insertSightings,
  listSnapshots,
  getSightingsBySnapshotId,
  getLatestSnapshot,
} from "./db"
import { applySchema } from "./test-utils"

describe("db helpers", () => {
  beforeEach(async () => {
    await applySchema(env.DB)
  })

  it("insertSnapshot returns the new snapshot id", async () => {
    const id = await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 5,
      rawHash: "abc123",
    })
    expect(id).toBe(1)
  })

  it("findSnapshotByHash finds existing hash", async () => {
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 5,
      rawHash: "abc123",
    })
    const found = await findSnapshotByHash(env.DB, "abc123")
    expect(found).toBe(true)
  })

  it("findSnapshotByHash returns false for unknown hash", async () => {
    const found = await findSnapshotByHash(env.DB, "unknown")
    expect(found).toBe(false)
  })

  it("insertSightings stores sighting rows", async () => {
    const snapshotId = await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 1,
      rawHash: "hash1",
    })
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
    ])
    const sightings = await getSightingsBySnapshotId(env.DB, snapshotId)
    expect(sightings).toHaveLength(1)
    expect(sightings[0].num_individuals).toBe(3)
  })

  it("listSnapshots returns snapshots ordered by fetched_at desc", async () => {
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T06:00:00Z",
      featureCount: 2,
      rawHash: "h1",
    })
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 3,
      rawHash: "h2",
    })
    const list = await listSnapshots(env.DB, 10, 0)
    expect(list).toHaveLength(2)
    expect(list[0].fetched_at).toBe("2026-02-25T12:00:00Z")
  })

  it("getLatestSnapshot returns the most recent snapshot", async () => {
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T06:00:00Z",
      featureCount: 2,
      rawHash: "h1",
    })
    await insertSnapshot(env.DB, {
      fetchedAt: "2026-02-25T12:00:00Z",
      featureCount: 3,
      rawHash: "h2",
    })
    const latest = await getLatestSnapshot(env.DB)
    expect(latest).not.toBeNull()
    expect(latest!.fetched_at).toBe("2026-02-25T12:00:00Z")
  })
})
