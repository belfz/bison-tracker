<script lang="ts">
  import type { Entry } from "../types"
  import { formatDate } from "../format"

  let { entry }: { entry: Entry } = $props()

  let isLive = $derived(entry.snapshot.id === null)

  let dateText = $derived(isLive ? "Live" : formatDate(entry.snapshot.fetched_at))

  let metaText = $derived.by(() => {
    if (isLive) {
      const n = entry.sightings.length
      return `${n} sighting${n !== 1 ? "s" : ""} · just now`
    }
    const n = entry.snapshot.feature_count
    return `Snapshot #${entry.snapshot.id} · ${n} sighting${n !== 1 ? "s" : ""}`
  })
</script>

<div class="snapshot-info">
  <div class="snapshot-date" class:live={isLive}>{dateText}</div>
  <div class="snapshot-meta">{metaText}</div>
</div>

<style>
  .snapshot-info {
    text-align: center;
    flex: 1;
    min-width: 0;
  }

  .snapshot-date {
    font-size: 15px;
    font-weight: 600;
    color: #1b4332;
  }

  .snapshot-date.live {
    color: #c2410c;
  }

  .snapshot-meta {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }

  @media (max-width: 480px) {
    .snapshot-date {
      font-size: 13px;
    }

    .snapshot-meta {
      font-size: 10px;
    }
  }
</style>
