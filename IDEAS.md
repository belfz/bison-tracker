# Ideas

## ~~Herd movement trails~~

~~For each grid square that appears across multiple snapshots, draw a fading polyline connecting its centroids over time. This would reveal migration patterns and favorite corridors, turning the static rectangle view into an animated "where have they been" replay.~~

Rejected: without reliable herd identification in the data, connecting squares across snapshots produces noise rather than insight, especially when herds are clustered in a small area.

## Seasonal heatmaps

Extend the existing heatmap with a season filter (spring, summer, autumn, winter) to compare bison distribution across seasons. This would answer questions like "do herds move to different areas in winter?" or "is there a summer range they favor?" The backend already supports a `months` parameter on `/api/heatmap`; this could be extended with `from`/`to` date params or predefined season presets. The UI would add a season picker to the toolbar when in heatmap mode.

## Change detection alerts

Compare each new snapshot to the previous one and flag noteworthy events: a herd appearing in a grid square it hasn't occupied in the last N days, a sudden jump in total individuals, or a herd splitting (one square becoming two nearby squares). Surface these as a feed on the UI or push notifications via a Web Push worker.

## ~~Heatmap layer~~ (implemented)

~~Aggregate all historical sightings into a density heatmap (Leaflet has `leaflet.heat` for this). Toggle between the current "single snapshot rectangles" view and an "all time" heatmap showing which areas are most frequented. Could also support a date range slider to see seasonal patterns — e.g., do herds cluster differently in winter vs. summer?~~

Implemented via `GET /api/heatmap` and the "Heatmap" toggle in the UI toolbar. Seasonality to be addressed separately.
