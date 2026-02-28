<script lang="ts">
  import { onMount } from "svelte"
  import L from "leaflet"
  import type { Entry } from "../types"
  import SnapshotInfo from "./SnapshotInfo.svelte"

  let {
    entry,
    canGoPrev,
    canGoNext,
    onPrev,
    onNext,
  }: {
    entry: Entry
    canGoPrev: boolean
    canGoNext: boolean
    onPrev: () => void
    onNext: () => void
  } = $props()

  let controlsEl: HTMLDivElement

  onMount(() => {
    L.DomEvent.disableClickPropagation(controlsEl)
    L.DomEvent.disableScrollPropagation(controlsEl)
  })
</script>

<div class="controls" bind:this={controlsEl}>
  <button disabled={!canGoPrev} onclick={onPrev} title="Previous snapshot">&larr; Prev</button>
  <SnapshotInfo {entry} />
  <button disabled={!canGoNext} onclick={onNext} title="Next snapshot">Next &rarr;</button>
</div>

<style>
  .controls {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    width: 460px;
    z-index: 1000;
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    user-select: none;
    touch-action: manipulation;
  }

  .controls button {
    background: #2d6a4f;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .controls button:hover:not(:disabled) {
    background: #1b4332;
  }
  .controls button:active:not(:disabled) {
    background: #1b4332;
  }
  .controls button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .controls {
      width: auto;
      left: 8px;
      right: 8px;
      transform: none;
      bottom: 44px;
      padding: 10px 12px;
      gap: 8px;
      min-height: 72px;
    }

    .controls button {
      padding: 12px 14px;
    }
  }
</style>
