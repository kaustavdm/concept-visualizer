<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    sidebar?: Snippet;
    main: Snippet;
    editor: Snippet;
    dock?: Snippet;
  }

  let { sidebar, main, editor, dock }: Props = $props();

  let sidebarOpen = $state(true);
  let editorOpen = $state(true);
</script>

<div class="flex h-screen w-screen overflow-hidden" style="background: var(--canvas-bg); color: var(--text-primary)">
  {#if sidebar}
    <aside
      class="flex-shrink-0 overflow-hidden flex flex-col transition-[width] duration-200"
      style="border-right: 1px solid var(--border); background: var(--surface-bg); width: {sidebarOpen ? '14rem' : '0px'}"
    >
      {#if sidebarOpen}
        <div class="flex-1 overflow-y-auto w-56">
          {@render sidebar()}
        </div>
        <div class="p-3 w-56" style="border-top: 1px solid var(--border)"></div>
      {/if}
    </aside>
    <button
      onclick={() => sidebarOpen = !sidebarOpen}
      class="flex-shrink-0 w-5 flex items-center justify-center transition-colors"
      style="background: var(--surface-bg); border-right: 1px solid var(--border); color: var(--text-muted)"
      title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" style="fill: currentColor">
        {#if sidebarOpen}
          <path d="M7 1L3 5l4 4" />
        {:else}
          <path d="M3 1l4 4-4 4" />
        {/if}
      </svg>
    </button>
  {/if}

  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <main class="flex-1 min-w-0 overflow-hidden relative">
      {@render main()}
    </main>
    {#if dock}
      {@render dock()}
    {/if}
  </div>

  <button
    onclick={() => editorOpen = !editorOpen}
    class="flex-shrink-0 w-5 flex items-center justify-center transition-colors"
    style="background: var(--surface-bg); border-left: 1px solid var(--border); color: var(--text-muted)"
    title={editorOpen ? 'Collapse editor' : 'Expand editor'}
  >
    <svg width="10" height="10" viewBox="0 0 10 10" style="fill: currentColor">
      {#if editorOpen}
        <path d="M3 1l4 4-4 4" />
      {:else}
        <path d="M7 1L3 5l4 4" />
      {/if}
    </svg>
  </button>
  <aside
    class="flex-shrink-0 overflow-hidden flex flex-col transition-[width] duration-200"
    style="border-left: 1px solid var(--border); background: var(--surface-bg); width: {editorOpen ? '420px' : '0px'}"
  >
    {#if editorOpen}
      <div class="w-[420px] flex flex-col h-full">
        {@render editor()}
      </div>
    {/if}
  </aside>
</div>
