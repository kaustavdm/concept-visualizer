<script lang="ts">
  import type { Layer3d, SerializableEntitySpec } from '$lib/3d/types';
  import VoiceInput from './VoiceInput.svelte';

  interface Props {
    layers: Layer3d[];
    onToggleVisibility: (layerId: string) => void;
    onUpdateText: (layerId: string, text: string) => void;
    onUpdateEntities: (layerId: string, entities: SerializableEntitySpec[]) => void;
    onAddLayer: () => void;
    onRemoveLayer: (layerId: string) => void;
    onGenerate?: (layerId: string, text: string) => void;
  }

  let {
    layers,
    onToggleVisibility,
    onUpdateText,
    onUpdateEntities,
    onAddLayer,
    onRemoveLayer,
    onGenerate,
  }: Props = $props();

  let panelExpanded = $state(true);
  let expandedLayerId: string | null = $state(null);
  let jsonErrors: Record<string, string> = $state({});
  let hoveredLayerId: string | null = $state(null);

  let sortedLayers = $derived(
    [...layers].sort((a, b) => a.order - b.order)
  );

  function toggleExpand(layerId: string) {
    expandedLayerId = expandedLayerId === layerId ? null : layerId;
  }

  function handleTextInput(layerId: string, event: Event) {
    const target = event.target as HTMLTextAreaElement;
    onUpdateText(layerId, target.value);
  }

  function handleVoiceTranscript(layerId: string, transcript: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      const newText = layer.text ? layer.text + ' ' + transcript : transcript;
      onUpdateText(layerId, newText);
    }
  }

  function handleJsonInput(layerId: string, event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const value = target.value;
    try {
      const parsed = JSON.parse(value) as SerializableEntitySpec[];
      if (!Array.isArray(parsed)) {
        jsonErrors = { ...jsonErrors, [layerId]: 'Must be an array' };
        return;
      }
      const { [layerId]: _, ...rest } = jsonErrors;
      jsonErrors = rest;
      onUpdateEntities(layerId, parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      jsonErrors = { ...jsonErrors, [layerId]: msg };
    }
  }

  function handleGenerate(layerId: string, text: string) {
    onGenerate?.(layerId, text);
  }

  function entityCountLabel(count: number): string {
    return count === 1 ? '1 entity' : `${count} entities`;
  }
</script>

<div class="layers-panel" role="region" aria-label="Scene layers">
  <!-- Header -->
  <div class="panel-header">
    <button
      class="panel-toggle"
      onclick={() => (panelExpanded = !panelExpanded)}
      aria-expanded={panelExpanded}
      aria-controls="layers-list-drawer"
    >
      <span class="chevron" class:chevron-collapsed={!panelExpanded}>&#x25BE;</span>
      <span class="panel-title">Layers</span>
    </button>
    <button
      class="add-btn"
      onclick={onAddLayer}
      aria-label="Add new layer"
      title="Add layer"
    >
      <!-- Plus icon -->
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <!-- Layer list -->
  <div
    id="layers-list-drawer"
    class="layer-list-drawer"
    class:drawer-collapsed={!panelExpanded}
  >
  <div class="layer-list">
    {#each sortedLayers as layer (layer.id)}
      {@const isExpanded = expandedLayerId === layer.id}
      {@const isHovered = hoveredLayerId === layer.id}
      <div
        class="layer-item"
        class:hidden-layer={!layer.visible}
        onmouseenter={() => (hoveredLayerId = layer.id)}
        onmouseleave={() => (hoveredLayerId = null)}
        role="group"
        aria-label={layer.name}
      >
        <!-- Layer header row -->
        <div class="layer-header">
          <!-- Visibility toggle -->
          <button
            class="visibility-btn"
            onclick={() => onToggleVisibility(layer.id)}
            aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
            title={layer.visible ? 'Hide layer' : 'Show layer'}
          >
            {#if layer.visible}
              <!-- Eye open icon -->
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            {:else}
              <!-- Eye closed icon (hollow circle) -->
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            {/if}
          </button>

          <!-- Layer name (clickable to expand/collapse) -->
          <button
            class="layer-name-btn"
            onclick={() => toggleExpand(layer.id)}
            aria-expanded={isExpanded}
            aria-controls="layer-detail-{layer.id}"
          >
            <span class="layer-name" title={layer.name}>{layer.name}</span>
          </button>

          <!-- Remove button (visible on hover) -->
          <button
            class="remove-btn"
            class:visible={isHovered}
            onclick={() => onRemoveLayer(layer.id)}
            aria-label="Remove {layer.name}"
            title="Remove layer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <!-- Entity count + expand indicator -->
        <button
          class="entity-count-row"
          onclick={() => toggleExpand(layer.id)}
          aria-label={isExpanded ? 'Collapse layer details' : 'Expand layer details'}
        >
          <span class="expand-indicator">{isExpanded ? '\u25BE' : '\u25B8'}</span>
          <span class="entity-count">{entityCountLabel(layer.entities.length)}</span>
        </button>

        <!-- Expanded detail panel -->
        {#if isExpanded}
          <div class="layer-detail" id="layer-detail-{layer.id}">
            <!-- Text description -->
            <label class="detail-label" for="layer-text-{layer.id}">
              Description
            </label>
            <div class="text-input-row">
              <textarea
                id="layer-text-{layer.id}"
                class="text-area"
                rows="3"
                placeholder="Describe this layer..."
                value={layer.text}
                oninput={(e) => handleTextInput(layer.id, e)}
              ></textarea>
              <VoiceInput
                onTranscript={(text) => handleVoiceTranscript(layer.id, text)}
              />
            </div>

            <!-- JSON editor -->
            <label class="detail-label" for="layer-json-{layer.id}">
              Entities (JSON)
            </label>
            <textarea
              id="layer-json-{layer.id}"
              class="json-area"
              rows="6"
              value={JSON.stringify(layer.entities, null, 2)}
              oninput={(e) => handleJsonInput(layer.id, e)}
              spellcheck="false"
            ></textarea>
            {#if jsonErrors[layer.id]}
              <div class="json-error" role="alert">
                {jsonErrors[layer.id]}
              </div>
            {/if}

            <!-- Generate button -->
            {#if onGenerate}
              <button
                class="generate-btn"
                onclick={() => handleGenerate(layer.id, layer.text)}
                disabled={!layer.text.trim()}
                aria-label="Generate entities from description"
              >
                Generate
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  </div>
</div>

<style>
  .layers-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 280px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    z-index: 15;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .panel-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .chevron {
    font-size: 12px;
    color: var(--pad-icon-muted);
    transition: transform 0.2s ease;
    line-height: 1;
  }

  .chevron-collapsed {
    transform: rotate(-90deg);
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--pad-icon);
    letter-spacing: 0.02em;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    cursor: pointer;
    transition: background 0.15s;
    padding: 0;
  }

  .add-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .layer-list-drawer {
    max-height: calc(100vh - 260px);
    overflow: hidden;
    transition: max-height 0.2s ease;
  }

  .drawer-collapsed {
    max-height: 0;
  }

  .layer-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .layer-item {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--glass-border);
    transition: opacity 0.2s;
  }

  .layer-item:last-child {
    border-bottom: none;
  }

  .layer-item.hidden-layer {
    opacity: 0.45;
  }

  .layer-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px 0 12px;
  }

  .visibility-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--pad-icon-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .visibility-btn:hover {
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
  }

  .layer-name-btn {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .layer-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--pad-icon);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--pad-icon-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, background 0.15s;
  }

  .remove-btn.visible {
    opacity: 1;
  }

  .remove-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }

  .entity-count-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 12px 8px 36px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .expand-indicator {
    font-size: 10px;
    color: var(--pad-icon-muted);
    line-height: 1;
  }

  .entity-count {
    font-size: 11px;
    color: var(--pad-icon-muted);
  }

  .layer-detail {
    padding: 4px 12px 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--glass-border);
  }

  .detail-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--pad-icon-muted);
    margin-top: 4px;
  }

  .text-input-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .text-area {
    flex: 1;
    font-family: var(--font-main);
    font-size: 12px;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    padding: 6px 8px;
    resize: vertical;
    min-height: 40px;
    outline: none;
    transition: border-color 0.15s;
  }

  .text-area::placeholder {
    color: var(--pad-icon-muted);
    opacity: 0.7;
  }

  .text-area:focus {
    border-color: var(--accent);
  }

  .json-area {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 11px;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    padding: 6px 8px;
    resize: vertical;
    min-height: 60px;
    outline: none;
    line-height: 1.4;
    tab-size: 2;
    transition: border-color 0.15s;
  }

  .json-area:focus {
    border-color: var(--accent);
  }

  .json-error {
    font-size: 11px;
    color: #ef4444;
    padding: 2px 0;
    line-height: 1.3;
  }

  .generate-btn {
    align-self: flex-start;
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 500;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 2px;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--pad-btn-bg-hover);
  }

  .generate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Scrollbar styling for the panel */
  .layers-panel::-webkit-scrollbar {
    width: 4px;
  }

  .layers-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .layers-panel::-webkit-scrollbar-thumb {
    background: var(--glass-border);
    border-radius: 2px;
  }
</style>
