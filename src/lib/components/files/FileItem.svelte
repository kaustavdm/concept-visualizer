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
  let editTitle = $state(file.title);

  function startEditing(e: MouseEvent) {
    e.stopPropagation();
    editing = true;
    editTitle = file.title;
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

<button
  class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors group
    {active ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-100'}"
  onclick={onclick}
>
  {#if editing}
    <input
      class="w-full bg-white border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
      bind:value={editTitle}
      onblur={finishEditing}
      onkeydown={handleKeydown}
      autofocus
    />
  {:else}
    <div class="flex items-center justify-between">
      <span class="truncate">{file.title}</span>
      <span class="hidden group-hover:flex gap-1">
        <button onclick={startEditing} class="text-gray-400 hover:text-gray-600 text-xs" title="Rename">
          &#9998;
        </button>
        <button onclick={(e) => { e.stopPropagation(); ondelete(); }} class="text-gray-400 hover:text-red-500 text-xs" title="Delete">
          &times;
        </button>
      </span>
    </div>
    <span class="text-[10px] text-gray-400">
      {file.updatedAt.toLocaleDateString()}
    </span>
  {/if}
</button>
