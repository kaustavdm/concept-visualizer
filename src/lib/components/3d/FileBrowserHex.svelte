<script lang="ts">
  import type { File3d } from '$lib/3d/types';
  import { files3dStore } from '$lib/stores/files3d';

  interface Props {
    files: File3d[];
    activeFileId: string | null;
    onSelectFile: (id: string) => void;
    onCreateFile: () => void;
    onDeleteFile?: (id: string) => void;
    onCloneFile?: () => void;
    onShowFileList?: () => void;
  }

  let {
    files,
    activeFileId,
    onSelectFile,
    onCreateFile,
    onDeleteFile,
    onCloneFile,
    onShowFileList,
  }: Props = $props();

  // --- State ---

  type BrowserState = 'collapsed' | 'fan';
  let browserState: BrowserState = $state('collapsed');
  let hovered = $state(false);
  let hoveredFanNode: string | null = $state(null);
  let editing = $state(false);
  let editValue = $state('');
  let editInput: HTMLInputElement | undefined = $state();

  // --- Derived ---

  let activeFile = $derived(
    activeFileId ? files.find((f) => f.id === activeFileId) ?? null : null
  );

  let displayName = $derived(activeFile?.title ?? 'Untitled');

  // --- Fan action items ---

  type ActionItem = {
    id: string;
    label: string;
    icon: 'clone' | 'files';
  };

  const fanActions: ActionItem[] = [
    { id: 'clone', label: 'Clone', icon: 'clone' },
    { id: 'files', label: 'Files', icon: 'files' },
  ];

  function fanPosition(index: number): { x: number; y: number } {
    // Position at ~45deg and ~75deg below-right, 55px radius
    const angles = [Math.PI * 0.25, Math.PI * 0.42];
    const radius = 55;
    const angle = angles[index] ?? Math.PI * 0.35;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  let fanPositions = $derived(
    fanActions.map((action, i) => ({
      ...action,
      ...fanPosition(i),
    }))
  );

  // --- Auto-focus + select on edit ---

  $effect(() => {
    if (editing && editInput) {
      editInput.focus();
      editInput.select();
    }
  });

  // --- Handlers ---

  function handleButtonClick() {
    if (editing) return;
    if (browserState === 'collapsed') {
      browserState = 'fan';
    } else {
      browserState = 'collapsed';
    }
  }

  function handleDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    if (!activeFile) return;
    editing = true;
    editValue = activeFile.title;
    browserState = 'collapsed';
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

  function handleFanClick(action: ActionItem) {
    browserState = 'collapsed';
    if (action.id === 'clone') {
      onCloneFile?.();
    } else if (action.id === 'files') {
      onShowFileList?.();
    }
  }

  function handleBackdropClick() {
    browserState = 'collapsed';
  }
</script>

<!-- Backdrop: closes fan when clicking outside -->
{#if browserState !== 'collapsed'}
  <button
    class="backdrop"
    onclick={handleBackdropClick}
    aria-label="Close file browser"
    tabindex="-1"
  ></button>
{/if}

<div
  class="file-browser"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  role="toolbar"
  tabindex="0"
  aria-label="File browser"
>
  <!-- Main button -->
  <button
    class="browser-btn"
    class:browser-btn-active={hovered || browserState !== 'collapsed'}
    onclick={handleButtonClick}
    ondblclick={handleDoubleClick}
    aria-label={browserState === 'collapsed' ? 'Open file actions' : 'Close file actions'}
    aria-expanded={browserState !== 'collapsed'}
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

  <!-- Fan-out actions -->
  {#if browserState === 'fan'}
    <div class="fan-container" aria-label="File actions">
      <svg
        viewBox="-20 -20 120 100"
        width="120"
        height="100"
        class="fan-svg"
        overflow="visible"
      >
        {#each fanPositions as item, i}
          <g
            class="fan-node"
            style="--fan-delay: {i * 40}ms;"
          >
            <!-- Circle -->
            <circle
              cx={item.x}
              cy={item.y}
              r="22"
              class="fan-circle"
              class:fan-circle-hovered={hoveredFanNode === item.id}
              onclick={() => handleFanClick(item)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleFanClick(item);
              }}
              onmouseenter={() => (hoveredFanNode = item.id)}
              onmouseleave={() => (hoveredFanNode = null)}
              role="button"
              tabindex="0"
              aria-label={item.label}
            />
            <!-- Icon -->
            {#if item.icon === 'clone'}
              <g
                transform="translate({item.x - 7}, {item.y - 7})"
                pointer-events="none"
              >
                <rect x="2" y="0" width="9" height="11" rx="1.5"
                  fill="none" stroke="var(--text-primary)" stroke-width="1.3" />
                <rect x="5" y="3" width="9" height="11" rx="1.5"
                  fill="var(--glass-bg)" stroke="var(--text-primary)" stroke-width="1.3" />
              </g>
            {:else if item.icon === 'files'}
              <g
                transform="translate({item.x - 6}, {item.y - 7})"
                pointer-events="none"
              >
                <rect x="0" y="0" width="12" height="3" rx="0.5"
                  fill="var(--text-primary)" opacity="0.8" />
                <rect x="0" y="5" width="12" height="3" rx="0.5"
                  fill="var(--text-primary)" opacity="0.5" />
                <rect x="0" y="10" width="12" height="3" rx="0.5"
                  fill="var(--text-primary)" opacity="0.3" />
              </g>
            {/if}
            <!-- Label below icon -->
            <text
              x={item.x}
              y={item.y + 16}
              text-anchor="middle"
              class="fan-label"
              pointer-events="none"
            >{item.label}</text>
          </g>
        {/each}
      </svg>
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 14;
    background: transparent;
    border: none;
    cursor: default;
    padding: 0;
    margin: 0;
  }

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

  /* --- Fan-out --- */

  .fan-container {
    position: absolute;
    top: 18px;
    left: 20px;
    pointer-events: none;
  }

  .fan-svg {
    pointer-events: none;
    overflow: visible;
  }

  .fan-node {
    animation: fan-in 200ms ease forwards;
    animation-delay: var(--fan-delay);
    opacity: 0;
    transform: scale(0.5);
  }

  @keyframes fan-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .fan-circle {
    fill: var(--glass-bg);
    stroke: var(--glass-border);
    stroke-width: 1.5;
    cursor: pointer;
    pointer-events: all;
    transition: fill 0.15s, stroke 0.15s;
  }

  .fan-circle:hover,
  .fan-circle-hovered {
    fill: var(--glass-bg-hover, rgba(255, 255, 255, 0.15));
    stroke: var(--accent);
  }

  .fan-label {
    font-family: var(--font-main);
    font-size: 7px;
    font-weight: 500;
    fill: var(--text-primary);
    opacity: 0.7;
  }
</style>
