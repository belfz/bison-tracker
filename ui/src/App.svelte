<script lang="ts">
  import { onMount } from "svelte"
  import type { Entry } from "./types"
  import { fetchBatch, fetchLive } from "./api"
  import BisonMap from "./components/BisonMap.svelte"
  import Controls from "./components/Controls.svelte"
  import LoadingOverlay from "./components/LoadingOverlay.svelte"

  const PREFETCH_THRESHOLD = 5

  let entries: Entry[] = $state([])
  let currentIndex = $state(0)
  let allLoaded = $state(false)
  let fetching = $state(false)
  let loadingMessage: string | null = $state("Loading snapshots...")

  let currentEntry = $derived(entries[currentIndex])
  let canGoPrev = $derived(currentIndex < entries.length - 1 || !allLoaded)
  let canGoNext = $derived(currentIndex > 0)

  async function loadBatch(beforeId?: number) {
    if (fetching || allLoaded) return
    fetching = true
    try {
      const result = await fetchBatch(beforeId)
      entries = [...entries, ...result.entries]
      if (result.allLoaded) allLoaded = true
    } finally {
      fetching = false
    }
  }

  async function goTo(index: number) {
    if (index < 0 || index >= entries.length) return
    currentIndex = index

    const remaining = entries.length - 1 - currentIndex
    if (remaining < PREFETCH_THRESHOLD && !allLoaded) {
      const lastStored = [...entries].reverse().find((e) => e.snapshot.id !== null)
      if (lastStored) await loadBatch(lastStored.snapshot.id!)
    }
  }

  function goPrev() {
    goTo(currentIndex + 1)
  }

  function goNext() {
    goTo(currentIndex - 1)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") goPrev()
    if (e.key === "ArrowRight") goNext()
  }

  onMount(async () => {
    try {
      const [liveRes] = await Promise.allSettled([fetchLive(), loadBatch()])

      if (liveRes.status === "fulfilled") {
        entries = [liveRes.value, ...entries]
      }

      if (entries.length === 0) {
        loadingMessage = "No data available yet."
        return
      }

      loadingMessage = null
      currentIndex = 0
    } catch (err) {
      loadingMessage = `Error: ${(err as Error).message}`
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<BisonMap sightings={currentEntry?.sightings ?? []} />

{#if loadingMessage}
  <LoadingOverlay message={loadingMessage} />
{:else if currentEntry}
  <Controls
    entry={currentEntry}
    {canGoPrev}
    {canGoNext}
    onPrev={goPrev}
    onNext={goNext}
  />
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
</style>
