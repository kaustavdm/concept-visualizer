<script lang="ts">
  import type { Scene3d } from '$lib/3d/entity-spec';

  interface Props {
    files: Scene3d[];
    activeFileId: string | null;
    onSelectFile: (id: string) => void;
    onCreateFile: () => void;
    onDeleteFile?: (id: string) => void;
    onClose: () => void;
  }

  let {
    files,
    activeFileId,
    onSelectFile,
    onCreateFile,
    onDeleteFile,
    onClose,
  }: Props = $props();

  let searchQuery = $state('');
  let searchInput: HTMLInputElement | undefined = $state();
  let hoveredFileId: string | null = $state(null);

  let filteredFiles = $derived(
    searchQuery
      ? files.filter((f) =>
          f.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : files
  );

  $effect(() => {
    searchInput?.focus();
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }

  function handleSelect(id: string) {
    onSelectFile(id);
    onClose();
  }

  function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    onDeleteFile?.(id);
  }

  function handleNewScene() {
    onCreateFile();
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center"
  style="background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);"
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
>
  <div
    class="modal-panel w-full mx-4"
    role="dialog"
    aria-label="Scenes"
  >
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Scenes</h2>
      <button
        class="close-btn"
        onclick={onClose}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Search -->
    <div class="modal-search">
      <input
        bind:this={searchInput}
        type="text"
        class="search-input"
        placeholder="Search scenes..."
        bind:value={searchQuery}
      />
    </div>

    <!-- File list -->
    <div class="modal-list">
      {#each filteredFiles as file (file.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="file-row"
          class:file-row-active={file.id === activeFileId}
          class:file-row-hovered={hoveredFileId === file.id}
          onclick={() => handleSelect(file.id)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(file.id); }}
          onmouseenter={() => (hoveredFileId = file.id)}
          onmouseleave={() => (hoveredFileId = null)}
          role="button"
          tabindex="0"
          aria-label="Select {file.title}"
          aria-current={file.id === activeFileId ? 'true' : undefined}
        >
          <span class="file-title">{file.title}</span>
          {#if onDeleteFile && file.id !== activeFileId}
            <button
              class="delete-btn"
              onclick={(e) => handleDelete(e, file.id)}
              aria-label="Delete {file.title}"
              tabindex="-1"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      {/each}

      {#if filteredFiles.length === 0}
        <div class="empty-state">No scenes found</div>
      {/if}
    </div>

    <!-- New scene button -->
    <button
      class="new-scene-btn"
      onclick={handleNewScene}
      aria-label="Create new scene"
    >
      + New Scene
    </button>
  </div>
</div>

<style>
  .modal-panel {
    max-width: 480px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.08) 100%
    ), var(--glass-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--pad-btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .modal-search {
    padding: 0 20px 12px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    background: var(--pad-btn-bg);
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: var(--accent);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .modal-list {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    min-height: 0;
    border-top: 1px solid var(--glass-border);
    border-bottom: 1px solid var(--glass-border);
  }

  .file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    cursor: pointer;
    font-family: var(--font-main);
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.1s;
    gap: 8px;
  }

  .file-row:hover,
  .file-row-hovered {
    background: var(--pad-btn-bg-hover);
  }

  .file-row-active {
    background: var(--pad-btn-bg-active);
    color: var(--text-primary);
    font-weight: 600;
  }

  .file-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.1s, color 0.1s;
  }

  .file-row:hover .delete-btn,
  .file-row-hovered .delete-btn {
    display: flex;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .empty-state {
    padding: 20px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }

  .new-scene-btn {
    padding: 12px 20px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font-main);
    font-size: 13px;
    font-weight: 500;
    color: var(--accent);
    text-align: center;
    transition: background 0.1s;
    flex-shrink: 0;
  }

  .new-scene-btn:hover {
    background: var(--pad-btn-bg-hover);
  }
</style>
