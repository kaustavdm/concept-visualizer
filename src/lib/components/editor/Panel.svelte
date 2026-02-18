<script lang="ts">
  import { untrack } from 'svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    badge?: number | null;
    defaultOpen?: boolean;
    fill?: boolean;
    children: Snippet;
  }

  let { title, badge = null, defaultOpen = true, fill = false, children }: Props = $props();
  // untrack: prop sets initial value only; component owns open/closed state thereafter
  let open = $state(untrack(() => defaultOpen));
</script>

<div
  class="flex flex-col"
  style="{fill ? 'flex: 1 1 0%; min-height: 0;' : 'flex-shrink: 0;'} border-bottom: 1px solid var(--border)"
>
  <button
    class="flex items-center justify-between w-full px-4 py-2 flex-shrink-0 text-left select-none transition-opacity hover:opacity-75"
    style="background: var(--surface-bg); border-top: 1px solid var(--border)"
    onclick={() => (open = !open)}
  >
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-semibold uppercase tracking-widest" style="color: var(--text-muted)"
        >{title}</span
      >
      {#if badge && badge > 0}
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style="background: var(--accent-light); color: var(--accent-text)">{badge}</span
        >
      {/if}
    </div>
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      style="fill:none; stroke: var(--text-muted); stroke-width:1.5; transform: rotate({open
        ? 0
        : -90}deg); transition: transform 0.15s"
    >
      <path d="M1 1l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>

  {#if open}
    <div
      style="{fill
        ? 'flex: 1 1 0%; display: flex; flex-direction: column; min-height: 0; overflow: hidden;'
        : 'overflow-y: auto;'}"
    >
      {@render children()}
    </div>
  {/if}
</div>
