<script lang="ts">
  let { message }: { message: string } = $props()
</script>

<div class="loading">{message}</div>

<style>
  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    background: white;
    padding: 20px 32px;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    font-size: 16px;
    color: #333;
  }
</style>
