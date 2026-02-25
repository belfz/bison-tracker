import { describe, it, expect } from "vitest";
import { epsg3857ToWgs84, computeCentroid, computeBbox } from "./geo";

describe("epsg3857ToWgs84", () => {
  it("converts origin correctly", () => {
    const [lon, lat] = epsg3857ToWgs84(0, 0);
    expect(lon).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it("converts a known point in Poland (Warsaw area)", () => {
    const x = 2337709.3;
    const y = 6848757.7;
    const [lon, lat] = epsg3857ToWgs84(x, y);
    expect(lon).toBeCloseTo(21.0, 0);
    expect(lat).toBeCloseTo(52.2, 0);
  });
});

describe("computeBbox", () => {
  it("computes WGS84 bounding box from EPSG:3857 polygon ring", () => {
    const ring: [number, number][] = [
      [2337709, 6848757],
      [2337709, 6852089],
      [2341041, 6852089],
      [2341041, 6848757],
      [2337709, 6848757],
    ];
    const bbox = computeBbox(ring);
    expect(bbox.minLon).toBeCloseTo(21.0, 0);
    expect(bbox.maxLon).toBeCloseTo(21.03, 0);
    expect(bbox.minLat).toBeCloseTo(52.2, 0);
    expect(bbox.maxLat).toBeCloseTo(52.22, 0);
  });
});

describe("computeCentroid", () => {
  it("computes center of bounding box", () => {
    const bbox = { minLat: 52.0, maxLat: 53.0, minLon: 20.0, maxLon: 21.0 };
    const [lat, lon] = computeCentroid(bbox);
    expect(lat).toBeCloseTo(52.5, 5);
    expect(lon).toBeCloseTo(20.5, 5);
  });
});
