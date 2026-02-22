<script lang="ts">
  import type { Scene3d } from '$lib/3d/entity-spec';
  import { files3dStore } from '$lib/stores/files3d';

  interface Props {
    files: Scene3d[];
    activeFileId: string | null;
  }

  let { files, activeFileId }: Props = $props();

  // --- State ---

  let hovered = $state(false);
  let editing = $state(false);
  let editValue = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  // --- Derived ---

  let activeFile = $derived(
    activeFileId ? files.find((f) => f.id === activeFileId) ?? null : null
  );

  let displayName = $derived(activeFile?.title ?? 'Untitled');

  // --- Auto-focus + select on edit ---

  $effect(() => {
    if (editing && editInput) {
      editInput.focus();
      editInput.select();
    }
  });

  // --- Handlers ---

  function handleDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    if (!activeFile) return;
    editing = true;
    editValue = activeFile.title;
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  function commitEdit() {
    if (activeFileId && editValue.trim()) {
      files3dStore.rename(activeFileId, editValue.trim());
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }
</script>

<div
  class="file-browser"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  role="toolbar"
  tabindex="0"
  aria-label="Scene name"
>
  <!-- Main button — double-click to rename -->
  <button
    class="browser-btn"
    class:browser-btn-active={hovered}
    ondblclick={handleDoubleClick}
    aria-label="Double-click to rename scene"
    title="Double-click to rename"
  >
    {#if editing}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <input
        bind:this={editInput}
        type="text"
        class="edit-input"
        bind:value={editValue}
        onkeydown={handleEditKeyDown}
        onblur={commitEdit}
        onclick={(e) => e.stopPropagation()}
        ondblclick={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="btn-label">{displayName}</span>
    {/if}
  </button>
</div>

<style>
  .file-browser {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 15;
    font-family: var(--font-main);
  }

  /* --- Rounded rect button --- */

  .browser-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    max-width: 200px;
    height: 36px;
    padding: 0 14px;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    cursor: pointer;
    opacity: 0.75;
    transition: opacity 0.2s ease, background 0.15s, border-color 0.15s;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.08),
      0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .browser-btn:hover,
  .browser-btn-active {
    opacity: 1;
    background: var(--glass-bg);
    border-color: var(--accent);
  }

  .btn-label {
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1;
    pointer-events: none;
  }

  .edit-input {
    width: 100%;
    min-width: 80px;
    height: 24px;
    padding: 0 4px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--pad-btn-bg);
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 600;
    outline: none;
    box-sizing: border-box;
  }
</style>
