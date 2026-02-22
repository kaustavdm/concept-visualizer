<script lang="ts">
  import type { File3d } from '$lib/3d/types';

  interface Props {
    files: File3d[];
    activeFileId: string | null;
    onSelectFile: (id: string) => void;
    onCreateFile: () => void;
    onDeleteFile?: (id: string) => void;
  }

  let {
    files,
    activeFileId,
    onSelectFile,
    onCreateFile,
    onDeleteFile,
  }: Props = $props();

  // --- Constants ---

  const HEX_PATH = 'M30,0 L60,17 L60,52 L30,69 L0,52 L0,17 Z';
  const MAX_FAN_FILES = 5;

  // --- State ---

  type BrowserState = 'collapsed' | 'fan' | 'panel';
  let browserState: BrowserState = $state('collapsed');
  let hovered = $state(false);
  let searchQuery = $state('');
  let hoveredFanNode: string | null = $state(null);
  let hoveredFileId: string | null = $state(null);

  // --- Derived ---

  let activeFile = $derived(
    activeFileId ? files.find((f) => f.id === activeFileId) ?? null : null
  );

  let hexLabel = $derived(
    activeFile ? truncate(activeFile.title, 6) : 'Files'
  );

  /** Recent files excluding active, sorted newest first */
  let recentFiles = $derived(
    files
      .filter((f) => f.id !== activeFileId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  );

  /** Fan-out nodes: up to MAX_FAN_FILES recent files + "+" New */
  let fanFiles = $derived(recentFiles.slice(0, MAX_FAN_FILES));
  let hasMore = $derived(recentFiles.length > MAX_FAN_FILES);

  /** Build fan items: files + "+" node + optional "..." node */
  let fanItems = $derived.by(() => {
    const items: FanItem[] = fanFiles.map((f) => ({
      type: 'file' as const,
      id: f.id,
      label: truncate(f.title, 8),
    }));
    items.push({ type: 'new' as const, id: '__new__', label: '+ New' });
    if (hasMore) {
      items.push({ type: 'more' as const, id: '__more__', label: '...' });
    }
    return items;
  });

  let fanPositions = $derived(
    fanItems.map((item, i) => ({
      ...item,
      ...fanPosition(i, fanItems.length),
    }))
  );

  /** Panel file list filtered by search */
  let filteredFiles = $derived(
    searchQuery
      ? files.filter((f) =>
          f.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : files
  );

  // --- Types ---

  type FanItem = {
    type: 'file' | 'new' | 'more';
    id: string;
    label: string;
  };

  // --- Functions ---

  function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + '\u2026';
  }

  function fanPosition(index: number, total: number): { x: number; y: number } {
    const startAngle = Math.PI * 0.15;
    const endAngle = Math.PI * 0.85;
    const radius = 70;
    const angle =
      total <= 1
        ? Math.PI * 0.5
        : startAngle + (endAngle - startAngle) * (index / (total - 1));
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  function handleHexClick() {
    if (browserState === 'collapsed') {
      browserState = 'fan';
    } else {
      browserState = 'collapsed';
    }
  }

  function handleFanClick(item: FanItem & { x: number; y: number }) {
    if (item.type === 'file') {
      onSelectFile(item.id);
      browserState = 'collapsed';
    } else if (item.type === 'new') {
      onCreateFile();
      browserState = 'collapsed';
    } else if (item.type === 'more') {
      browserState = 'panel';
    }
  }

  function handlePanelFileClick(id: string) {
    onSelectFile(id);
    browserState = 'collapsed';
  }

  function handleBackdropClick() {
    browserState = 'collapsed';
    searchQuery = '';
  }

  function handleDeleteClick(e: MouseEvent, id: string) {
    e.stopPropagation();
    onDeleteFile?.(id);
  }

  function handlePanelNewClick() {
    onCreateFile();
    browserState = 'collapsed';
    searchQuery = '';
  }
</script>

<!-- Backdrop: closes browser when clicking outside -->
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
  <!-- Collapsed hex button -->
  <button
    class="hex-btn"
    class:hex-hovered={hovered || browserState !== 'collapsed'}
    onclick={handleHexClick}
    aria-label={browserState === 'collapsed' ? 'Open file browser' : 'Close file browser'}
    aria-expanded={browserState !== 'collapsed'}
  >
    <svg viewBox="0 0 60 69" width="60" height="52" class="hex-svg">
      <path
        d={HEX_PATH}
        class="hex-shape"
        class:hex-shape-active={browserState !== 'collapsed'}
      />
    </svg>
    <span class="hex-label">{hexLabel}</span>
  </button>

  <!-- Fan-out -->
  {#if browserState === 'fan'}
    <div class="fan-container" aria-label="Recent files">
      <svg
        viewBox="-100 -20 200 120"
        width="200"
        height="120"
        class="fan-svg"
        overflow="visible"
      >
        {#each fanPositions as item, i}
          <g
            class="fan-node"
            style="
              --fan-delay: {i * 40}ms;
              transform-origin: {item.x}px {item.y}px;
            "
          >
            <circle
              cx={item.x}
              cy={item.y}
              r="24"
              class="fan-circle"
              class:fan-circle-hovered={hoveredFanNode === item.id}
              class:fan-circle-new={item.type === 'new'}
              class:fan-circle-more={item.type === 'more'}
              onclick={() => handleFanClick(item)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleFanClick(item);
              }}
              onmouseenter={() => (hoveredFanNode = item.id)}
              onmouseleave={() => (hoveredFanNode = null)}
              role="button"
              tabindex="0"
              aria-label={item.type === 'new'
                ? 'Create new file'
                : item.type === 'more'
                  ? 'Show all files'
                  : item.label}
            />
            <text
              x={item.x}
              y={item.y}
              text-anchor="middle"
              dominant-baseline="central"
              class="fan-label"
              pointer-events="none"
            >{item.label}</text>
          </g>
        {/each}
      </svg>
    </div>
  {/if}

  <!-- Full panel -->
  {#if browserState === 'panel'}
    <div class="panel" role="dialog" aria-label="All files">
      <div class="panel-search">
        <input
          type="text"
          class="search-input"
          placeholder="Search files..."
          bind:value={searchQuery}
        />
      </div>

      <div class="panel-list">
        {#each filteredFiles as file (file.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="panel-file"
            class:panel-file-active={file.id === activeFileId}
            class:panel-file-hovered={hoveredFileId === file.id}
            onclick={() => handlePanelFileClick(file.id)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePanelFileClick(file.id); }}
            onmouseenter={() => (hoveredFileId = file.id)}
            onmouseleave={() => (hoveredFileId = null)}
            role="button"
            tabindex="0"
            aria-label="Select {file.title}"
            aria-current={file.id === activeFileId ? 'true' : undefined}
          >
            <span class="panel-file-title">{truncate(file.title, 20)}</span>
            {#if onDeleteFile && file.id !== activeFileId}
              <button
                class="delete-btn"
                onclick={(e) => handleDeleteClick(e, file.id)}
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
          <div class="panel-empty">No files found</div>
        {/if}
      </div>

      <button
        class="panel-new-btn"
        onclick={handlePanelNewClick}
        aria-label="Create new scene"
      >
        + New Scene
      </button>
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

  /* --- Hex button --- */

  .hex-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 52px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .hex-btn:hover,
  .hex-hovered {
    opacity: 1;
  }

  .hex-svg {
    position: absolute;
    inset: 0;
  }

  .hex-shape {
    fill: var(--glass-bg);
    stroke: var(--glass-border);
    stroke-width: 1.5;
    transition: fill 0.15s, stroke 0.15s;
  }

  .hex-shape:hover {
    fill: var(--glass-bg-hover);
  }

  .hex-shape-active {
    fill: var(--glass-bg-hover);
    stroke: var(--accent);
  }

  .hex-label {
    position: relative;
    z-index: 1;
    font-family: var(--font-main);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-primary);
    pointer-events: none;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 48px;
    text-align: center;
    line-height: 1;
  }

  /* --- Fan-out --- */

  .fan-container {
    position: absolute;
    top: 26px;
    left: -70px;
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
    fill: var(--glass-bg-hover);
    stroke: var(--accent);
  }

  .fan-circle-new {
    stroke: var(--accent);
    stroke-dasharray: 4 2;
  }

  .fan-circle-more:hover,
  .fan-circle-more.fan-circle-hovered {
    stroke: var(--text-muted);
  }

  .fan-label {
    font-family: var(--font-main);
    font-size: 8px;
    font-weight: 500;
    fill: var(--text-primary);
  }

  /* --- Panel --- */

  .panel {
    position: absolute;
    top: 60px;
    left: 0;
    width: 220px;
    max-height: 300px;
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
    border-radius: 10px;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.25),
      0 2px 8px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    animation: panel-appear 150ms ease forwards;
  }

  @keyframes panel-appear {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .panel-search {
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 12px;
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

  .panel-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 0;
  }

  .panel-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-main);
    font-size: 12px;
    color: var(--text-secondary);
    text-align: left;
    transition: background 0.1s;
    gap: 4px;
  }

  .panel-file:hover,
  .panel-file-hovered {
    background: var(--pad-btn-bg-hover);
  }

  .panel-file-active {
    background: var(--pad-btn-bg-active);
    color: var(--text-primary);
    font-weight: 600;
  }

  .panel-file-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.1s, color 0.1s;
  }

  .panel-file:hover .delete-btn,
  .panel-file-hovered .delete-btn {
    display: flex;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .panel-empty {
    padding: 12px 10px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  .panel-new-btn {
    padding: 8px 10px;
    border: none;
    border-top: 1px solid var(--glass-border);
    background: none;
    cursor: pointer;
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    text-align: center;
    transition: background 0.1s;
    flex-shrink: 0;
  }

  .panel-new-btn:hover {
    background: var(--pad-btn-bg-hover);
  }
</style>
