<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  onMount(async () => {
    await settingsStore.init();
    document.body.setAttribute('data-theme', $settingsStore.theme);
  });

  $effect(() => {
    if ($settingsStore.theme) {
      document.body.setAttribute('data-theme', $settingsStore.theme);
    }
  });
</script>

{@render children()}
