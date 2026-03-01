<script lang="ts">
  import { onMount } from "svelte"
  import L from "leaflet"
  import type { ViewMode } from "../types"

  let {
    mode,
    onModeChange,
  }: {
    mode: ViewMode
    onModeChange: (mode: ViewMode) => void
  } = $props()

  let toolbarEl: HTMLDivElement

  onMount(() => {
    L.DomEvent.disableClickPropagation(toolbarEl)
    L.DomEvent.disableScrollPropagation(toolbarEl)
  })
</script>

<div class="toolbar" bind:this={toolbarEl}>
  <button
    class:active={mode === "snapshots"}
    onclick={() => onModeChange("snapshots")}
    title="View snapshots"
  >
    Snapshots
  </button>
  <button
    class:active={mode === "heatmap"}
    onclick={() => onModeChange("heatmap")}
    title="View heatmap"
  >
    Heatmap
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px;
    display: flex;
    gap: 4px;
    user-select: none;
    touch-action: manipulation;
  }

  .toolbar button {
    background: transparent;
    color: #555;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .toolbar button:hover {
    background: #f0f0f0;
  }

  .toolbar button.active {
    background: #2d6a4f;
    color: white;
  }

  @media (max-width: 480px) {
    .toolbar button {
      padding: 10px 12px;
      font-size: 12px;
    }
  }
</style>
