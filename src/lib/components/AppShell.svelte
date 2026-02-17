<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    sidebar?: Snippet;
    main: Snippet;
    editor: Snippet;
    dock?: Snippet;
  }

  let { sidebar, main, editor, dock }: Props = $props();
</script>

<div class="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
  {#if sidebar}
    <aside class="w-56 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
      <div class="flex-1 overflow-y-auto">
        {@render sidebar()}
      </div>
      <div class="p-3 border-t border-gray-200">
        <a href="/settings" class="text-xs text-gray-400 hover:text-gray-600">Settings</a>
      </div>
    </aside>
  {/if}

  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <main class="flex-1 min-w-0 overflow-hidden relative">
      {@render main()}
    </main>
    {#if dock}
      {@render dock()}
    {/if}
  </div>

  <aside class="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
    {@render editor()}
  </aside>
</div>
