import { computeBbox, computeCentroid, type Bbox } from "./geo"
import type { SightingInput } from "./db"

interface GeoJsonFeature {
  type: string
  geometry: {
    type: string
    coordinates: [number, number][][]
  }
  properties: {
    aktualnosc: number
    ile_osobnikow: number
    plec: string
  }
}

interface GeoJsonFeatureCollection {
  type: string
  features: GeoJsonFeature[]
}

export function parseGeoJsonFeatures(raw: string): SightingInput[] {
  const data: GeoJsonFeatureCollection = JSON.parse(raw)
  if (!Array.isArray(data.features)) {
    throw new Error("Invalid GeoJSON: missing features array")
  }

  return data.features.map((feature) => {
    const ring = feature.geometry.coordinates[0] as [number, number][]
    const bbox: Bbox = computeBbox(ring)
    const [centroidLat, centroidLon] = computeCentroid(bbox)

    return {
      centroidLat,
      centroidLon,
      bboxMinLat: bbox.minLat,
      bboxMinLon: bbox.minLon,
      bboxMaxLat: bbox.maxLat,
      bboxMaxLon: bbox.maxLon,
      numIndividuals: feature.properties.ile_osobnikow,
      sex: feature.properties.plec,
    }
  })
}

export async function hashResponse(body: string): Promise<string> {
  const encoded = new TextEncoder().encode(body)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
