<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
</script>

<AppShell>
  {#snippet main()}
    <div class="flex items-center justify-center h-full text-gray-400">
      <p class="text-lg">Visualization canvas</p>
    </div>
  {/snippet}

  {#snippet editor()}
    <div class="p-4">
      <p class="text-sm text-gray-500">Editor pane</p>
    </div>
  {/snippet}
</AppShell>
