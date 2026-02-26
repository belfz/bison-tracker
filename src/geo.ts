const EARTH_RADIUS = 6378137
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS // 20037508.342789244

export function epsg3857ToWgs84(x: number, y: number): [lon: number, lat: number] {
  const lon = (x / ORIGIN_SHIFT) * 180
  const lat =
    (180 / Math.PI) * (2 * Math.atan(Math.exp((y / ORIGIN_SHIFT) * Math.PI)) - Math.PI / 2)
  return [lon, lat]
}

export interface Bbox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export function computeBbox(ring: [number, number][]): Bbox {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity

  for (const [x, y] of ring) {
    const [lon, lat] = epsg3857ToWgs84(x, y)
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }

  return { minLat, maxLat, minLon, maxLon }
}

export function computeCentroid(bbox: Bbox): [lat: number, lon: number] {
  return [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLon + bbox.maxLon) / 2]
}
