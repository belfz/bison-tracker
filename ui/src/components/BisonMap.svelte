<script lang="ts">
  import { onMount } from "svelte"
  import L from "leaflet"
  import "leaflet/dist/leaflet.css"
  import type { Sighting } from "../types"

  let { sightings }: { sightings: Sighting[] } = $props()

  let mapEl: HTMLDivElement
  let map: L.Map
  let rectangleLayer: L.LayerGroup

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
    if (!rectangleLayer) return

    rectangleLayer.clearLayers()

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

      const sexLabel = s.sex === "f" ? "Female" : s.sex === "m" ? "Male" : s.sex
      rect.bindPopup(
        `<strong>${s.num_individuals} individual${s.num_individuals !== 1 ? "s" : ""}</strong><br>(${sexLabel})`,
      )

      rectangleLayer.addLayer(rect)
    }
  })
</script>

<div class="map" bind:this={mapEl}></div>

<style>
  .map {
    width: 100%;
    height: 100vh;
  }
</style>
