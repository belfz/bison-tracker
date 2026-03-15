<script lang="ts">
  import { onMount } from "svelte"
  import L from "leaflet"
  import "leaflet/dist/leaflet.css"
  import "leaflet.heat"
  import type { Sighting, HeatmapPoint, ViewMode } from "../types"

  let {
    sightings,
    heatmapPoints,
    mode,
  }: {
    sightings: Sighting[]
    heatmapPoints: HeatmapPoint[]
    mode: ViewMode
  } = $props()

  let mapEl: HTMLDivElement
  let map: L.Map
  let rectangleLayer: L.LayerGroup
  let heatLayer: L.Layer | null = null

  onMount(() => {
    map = L.map(mapEl).setView([52.8, 16.5], 8)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    rectangleLayer = L.layerGroup().addTo(map)

    return () => {
      map.remove()
    }
  })

  $effect(() => {
    if (!rectangleLayer || !map) return

    rectangleLayer.clearLayers()

    if (mode !== "snapshots") {
      return
    }

    for (const s of sightings) {
      const bounds: L.LatLngBoundsExpression = [
        [s.bbox_min_lat, s.bbox_min_lon],
        [s.bbox_max_lat, s.bbox_max_lon],
      ]

      const rect = L.rectangle(bounds, {
        color: "#2d6a4f",
        weight: 2,
        fillColor: "#52b788",
        fillOpacity: 0.45,
      })

      const sexLabel = s.sex === "f" ? "F" : s.sex === "m" ? "M" : s.sex
      rect.bindPopup(
        `<strong>${s.num_individuals} individual${s.num_individuals !== 1 ? "s" : ""}</strong><br>(${sexLabel})`,
      )

      rectangleLayer.addLayer(rect)
    }
  })

  $effect(() => {
    if (!map) return

    if (heatLayer) {
      map.removeLayer(heatLayer)
      heatLayer = null
    }

    if (mode !== "heatmap" || heatmapPoints.length === 0) {
      return
    }

    const maxFreq = Math.max(...heatmapPoints.map((p) => p.frequency))
    const points: [number, number, number][] = heatmapPoints.map((p) => [
      p.lat,
      p.lon,
      p.frequency / maxFreq,
    ])

    heatLayer = (L as any).heatLayer(points, {
      radius: 30,
      blur: 25,
      maxZoom: 10,
      max: 1,
      minOpacity: 0.3,
      gradient: {
        0.2: "#ffffb2",
        0.4: "#fecc5c",
        0.6: "#fd8d3c",
        0.8: "#f03b20",
        1.0: "#bd0026",
      },
    })
    heatLayer!.addTo(map)
  })
</script>

<div class="map" bind:this={mapEl}></div>

<style>
  .map {
    width: 100%;
    height: 100vh;
  }
</style>
