<script lang="ts">
  import type { ConceptFile } from '$lib/types';
  import FileItem from './FileItem.svelte';

  interface Props {
    files: ConceptFile[];
    activeFileId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
  }

  let { files, activeFileId, onSelect, onCreate, onRename, onDelete }: Props = $props();
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-3 border-b border-gray-200">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Files</h2>
    <button
      onclick={onCreate}
      class="text-sm font-medium"
      style="color: var(--accent)"
      title="New file"
    >
      + New
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
    {#each files as file (file.id)}
      <FileItem
        {file}
        active={file.id === activeFileId}
        onclick={() => onSelect(file.id)}
        onrename={(title) => onRename(file.id, title)}
        ondelete={() => onDelete(file.id)}
      />
    {/each}

    {#if files.length === 0}
      <p class="text-xs text-gray-400 text-center py-4">No files yet</p>
    {/if}
  </div>
</div>
