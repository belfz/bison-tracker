# Ideas

## Herd movement trails

For each grid square that appears across multiple snapshots, draw a fading polyline connecting its centroids over time. This would reveal migration patterns and favorite corridors, turning the static rectangle view into an animated "where have they been" replay.

## Change detection alerts

Compare each new snapshot to the previous one and flag noteworthy events: a herd appearing in a grid square it hasn't occupied in the last N days, a sudden jump in total individuals, or a herd splitting (one square becoming two nearby squares). Surface these as a feed on the UI or push notifications via a Web Push worker.

## Heatmap layer

Aggregate all historical sightings into a density heatmap (Leaflet has `leaflet.heat` for this). Toggle between the current "single snapshot rectangles" view and an "all time" heatmap showing which areas are most frequented. Could also support a date range slider to see seasonal patterns — e.g., do herds cluster differently in winter vs. summer?
