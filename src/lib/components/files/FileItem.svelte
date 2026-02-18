<script lang="ts">
  import type { ConceptFile } from '$lib/types';

  interface Props {
    file: ConceptFile;
    active: boolean;
    onclick: () => void;
    onrename: (title: string) => void;
    ondelete: () => void;
  }

  let { file, active, onclick, onrename, ondelete }: Props = $props();
  let editing = $state(false);
  let editTitle = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (editing && inputEl) {
      inputEl.focus();
    }
  });

  function startEditing(e: MouseEvent) {
    e.stopPropagation();
    editTitle = file.title;
    editing = true;
  }

  function finishEditing() {
    editing = false;
    if (editTitle.trim() && editTitle !== file.title) {
      onrename(editTitle.trim());
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') finishEditing();
    if (e.key === 'Escape') { editing = false; }
  }
</script>

<div
  role="button"
  tabindex="0"
  class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors group cursor-pointer"
  style={active
    ? `background: var(--accent-light); color: var(--accent-text)`
    : `color: var(--text-secondary)`}
  onmouseenter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
  onmouseleave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = ''; }}
  onclick={onclick}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onclick(); }}
>
  {#if editing}
    <input
      bind:this={inputEl}
      class="w-full rounded px-1 py-0.5 text-sm focus:outline-none"
      style="background: var(--input-bg); border: 1px solid var(--accent); color: var(--text-primary)"
      bind:value={editTitle}
      onblur={finishEditing}
      onkeydown={handleKeydown}
    />
  {:else}
    <div class="flex items-center justify-between">
      <span class="truncate">{file.title}</span>
      <span class="hidden group-hover:flex gap-1">
        <button onclick={startEditing} class="text-xs" style="color: var(--text-muted)" title="Rename">
          &#9998;
        </button>
        <button onclick={(e) => { e.stopPropagation(); ondelete(); }} class="text-xs hover:text-red-500" style="color: var(--text-muted)" title="Delete">
          &times;
        </button>
      </span>
    </div>
    <span class="text-[10px]" style="color: var(--text-muted)">
      {file.updatedAt.toLocaleDateString()}
    </span>
  {/if}
</div>
