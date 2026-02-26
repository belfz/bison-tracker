import { describe, it, expect } from "vitest"
import { parseGeoJsonFeatures, hashResponse } from "./scraper"

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
})

describe("parseGeoJsonFeatures", () => {
  it("parses features and converts coordinates to WGS84", () => {
    const sightings = parseGeoJsonFeatures(sampleGeoJson)
    expect(sightings).toHaveLength(1)

    const s = sightings[0]
    expect(s.numIndividuals).toBe(2)
    expect(s.sex).toBe("f")
    expect(s.centroidLat).toBeCloseTo(52.2, 0)
    expect(s.centroidLon).toBeCloseTo(21.0, 0)
    expect(s.bboxMinLat).toBeLessThan(s.bboxMaxLat)
    expect(s.bboxMinLon).toBeLessThan(s.bboxMaxLon)
  })

  it("throws on invalid JSON", () => {
    expect(() => parseGeoJsonFeatures("not json")).toThrow()
  })

  it("throws on missing features array", () => {
    expect(() => parseGeoJsonFeatures(JSON.stringify({ type: "FeatureCollection" }))).toThrow()
  })
})

describe("hashResponse", () => {
  it("returns consistent hex SHA-256 hash", async () => {
    const hash1 = await hashResponse("hello world")
    const hash2 = await hashResponse("hello world")
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it("returns different hashes for different inputs", async () => {
    const hash1 = await hashResponse("hello")
    const hash2 = await hashResponse("world")
    expect(hash1).not.toBe(hash2)
  })
})
