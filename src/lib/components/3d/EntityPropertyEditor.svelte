<script lang="ts">
  import type { EntitySpec } from '$lib/3d/entity-spec';
  import EntityTreeItem from './EntityTreeItem.svelte';

  interface Props {
    entities: EntitySpec[];
    onUpdate: (entities: EntitySpec[]) => void;
  }

  let { entities, onUpdate }: Props = $props();

  let selectedEntityId: string | null = $state(null);

  let selectedEntity = $derived(
    selectedEntityId ? findEntity(entities, selectedEntityId) : null
  );

  function findEntity(list: EntitySpec[], id: string): EntitySpec | null {
    for (const e of list) {
      if (e.id === id) return e;
      if (e.children) {
        const found = findEntity(e.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /** Immutably update a single entity by ID in the tree */
  function updateEntityInTree(list: EntitySpec[], id: string, updater: (e: EntitySpec) => EntitySpec): EntitySpec[] {
    return list.map(e => {
      if (e.id === id) return updater(e);
      if (e.children) {
        const updated = updateEntityInTree(e.children, id, updater);
        if (updated !== e.children) return { ...e, children: updated };
      }
      return e;
    });
  }

  function updateField(entityId: string, path: string, value: unknown) {
    const updated = updateEntityInTree(entities, entityId, (e) => {
      const clone = structuredClone(e) as EntitySpec;
      setNestedValue(clone, path, value);
      return clone;
    });
    onUpdate(updated);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setNestedValue(obj: any, path: string, value: unknown) {
    const parts = path.split('.');
    let current = obj as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getNestedValue(obj: any, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /** Convert [r,g,b] (0-1) to hex string for color input */
  function rgbToHex(rgb: [number, number, number]): string {
    const r = Math.round(Math.min(1, Math.max(0, rgb[0])) * 255);
    const g = Math.round(Math.min(1, Math.max(0, rgb[1])) * 255);
    const b = Math.round(Math.min(1, Math.max(0, rgb[2])) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /** Convert hex string to [r,g,b] (0-1) */
  function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [Math.round(r * 100) / 100, Math.round(g * 100) / 100, Math.round(b * 100) / 100];
  }

  function removeEntity(id: string) {
    const filtered = entities.filter(e => e.id !== id);
    if (selectedEntityId === id) selectedEntityId = null;
    onUpdate(filtered);
  }

  const RENDER_TYPES = ['sphere', 'box', 'plane', 'cone', 'cylinder', 'torus', 'capsule'] as const;
  const LIGHT_TYPES = ['directional', 'omni', 'spot'] as const;
  const BLEND_TYPES = ['normal', 'additive', 'none'] as const;
</script>

<div class="property-editor">
  <!-- Entity tree -->
  <div class="entity-tree">
    {#if entities.length === 0}
      <div class="empty-hint">No entities</div>
    {:else}
      {#each entities as entity (entity.id)}
        <EntityTreeItem
          {entity}
          depth={0}
          selectedId={selectedEntityId}
          onSelect={(id) => { selectedEntityId = id; }}
        />
      {/each}
    {/if}
  </div>

  <!-- Property form for selected entity -->
  {#if selectedEntity}
    <div class="property-form">
      <!-- Transform section -->
      <div class="prop-section">
        <div class="prop-section-title">Transform</div>
        <div class="vec3-row">
          <label class="vec3-label">Pos</label>
          {#each [0, 1, 2] as i}
            <input
              class="vec3-input"
              type="number"
              step="0.1"
              value={(selectedEntity.position ?? [0, 0, 0])[i]}
              onchange={(e) => {
                const pos = [...(selectedEntity!.position ?? [0, 0, 0])] as [number, number, number];
                pos[i] = parseFloat((e.target as HTMLInputElement).value) || 0;
                updateField(selectedEntity!.id, 'position', pos);
              }}
            />
          {/each}
        </div>
        <div class="vec3-row">
          <label class="vec3-label">Rot</label>
          {#each [0, 1, 2] as i}
            <input
              class="vec3-input"
              type="number"
              step="1"
              value={(selectedEntity.rotation ?? [0, 0, 0])[i]}
              onchange={(e) => {
                const rot = [...(selectedEntity!.rotation ?? [0, 0, 0])] as [number, number, number];
                rot[i] = parseFloat((e.target as HTMLInputElement).value) || 0;
                updateField(selectedEntity!.id, 'rotation', rot);
              }}
            />
          {/each}
        </div>
        <div class="vec3-row">
          <label class="vec3-label">Scale</label>
          {#each [0, 1, 2] as i}
            <input
              class="vec3-input"
              type="number"
              step="0.1"
              value={(selectedEntity.scale ?? [1, 1, 1])[i]}
              onchange={(e) => {
                const scl = [...(selectedEntity!.scale ?? [1, 1, 1])] as [number, number, number];
                scl[i] = parseFloat((e.target as HTMLInputElement).value) || 0;
                updateField(selectedEntity!.id, 'scale', scl);
              }}
            />
          {/each}
        </div>
      </div>

      <!-- Render section -->
      {#if selectedEntity.components?.render}
        <div class="prop-section">
          <div class="prop-section-title">Render</div>
          <div class="prop-row">
            <label class="prop-label">Type</label>
            <select
              class="prop-select"
              value={selectedEntity.components.render.type}
              onchange={(e) => updateField(selectedEntity!.id, 'components.render.type', (e.target as HTMLSelectElement).value)}
            >
              {#each RENDER_TYPES as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>
          <div class="prop-row">
            <label class="prop-label">Shadows</label>
            <input
              type="checkbox"
              checked={selectedEntity.components.render.castShadows ?? false}
              onchange={(e) => updateField(selectedEntity!.id, 'components.render.castShadows', (e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>
      {/if}

      <!-- Light section -->
      {#if selectedEntity.components?.light}
        <div class="prop-section">
          <div class="prop-section-title">Light</div>
          <div class="prop-row">
            <label class="prop-label">Type</label>
            <select
              class="prop-select"
              value={selectedEntity.components.light.type}
              onchange={(e) => updateField(selectedEntity!.id, 'components.light.type', (e.target as HTMLSelectElement).value)}
            >
              {#each LIGHT_TYPES as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>
          <div class="prop-row">
            <label class="prop-label">Intensity</label>
            <input
              class="prop-slider"
              type="range"
              min="0" max="8" step="0.1"
              value={selectedEntity.components.light.intensity ?? 1}
              oninput={(e) => updateField(selectedEntity!.id, 'components.light.intensity', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="prop-value">{(selectedEntity.components.light.intensity ?? 1).toFixed(1)}</span>
          </div>
          {#if selectedEntity.components.light.color}
            <div class="prop-row">
              <label class="prop-label">Color</label>
              <input
                type="color"
                class="prop-color"
                value={rgbToHex(selectedEntity.components.light.color)}
                oninput={(e) => updateField(selectedEntity!.id, 'components.light.color', hexToRgb((e.target as HTMLInputElement).value))}
              />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Material section -->
      {#if selectedEntity.material}
        <div class="prop-section">
          <div class="prop-section-title">Material</div>
          {#if selectedEntity.material.diffuse}
            <div class="prop-row">
              <label class="prop-label">Diffuse</label>
              <input
                type="color"
                class="prop-color"
                value={rgbToHex(selectedEntity.material.diffuse)}
                oninput={(e) => updateField(selectedEntity!.id, 'material.diffuse', hexToRgb((e.target as HTMLInputElement).value))}
              />
            </div>
          {/if}
          {#if selectedEntity.material.emissive}
            <div class="prop-row">
              <label class="prop-label">Emissive</label>
              <input
                type="color"
                class="prop-color"
                value={rgbToHex(selectedEntity.material.emissive)}
                oninput={(e) => updateField(selectedEntity!.id, 'material.emissive', hexToRgb((e.target as HTMLInputElement).value))}
              />
            </div>
          {/if}
          <div class="prop-row">
            <label class="prop-label">Metalness</label>
            <input
              class="prop-slider"
              type="range"
              min="0" max="1" step="0.05"
              value={selectedEntity.material.metalness ?? 0}
              oninput={(e) => updateField(selectedEntity!.id, 'material.metalness', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="prop-value">{(selectedEntity.material.metalness ?? 0).toFixed(2)}</span>
          </div>
          <div class="prop-row">
            <label class="prop-label">Gloss</label>
            <input
              class="prop-slider"
              type="range"
              min="0" max="1" step="0.05"
              value={selectedEntity.material.gloss ?? 0.5}
              oninput={(e) => updateField(selectedEntity!.id, 'material.gloss', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="prop-value">{(selectedEntity.material.gloss ?? 0.5).toFixed(2)}</span>
          </div>
          <div class="prop-row">
            <label class="prop-label">Opacity</label>
            <input
              class="prop-slider"
              type="range"
              min="0" max="1" step="0.05"
              value={selectedEntity.material.opacity ?? 1}
              oninput={(e) => updateField(selectedEntity!.id, 'material.opacity', parseFloat((e.target as HTMLInputElement).value))}
            />
            <span class="prop-value">{(selectedEntity.material.opacity ?? 1).toFixed(2)}</span>
          </div>
          {#if selectedEntity.material.blendType !== undefined}
            <div class="prop-row">
              <label class="prop-label">Blend</label>
              <select
                class="prop-select"
                value={selectedEntity.material.blendType}
                onchange={(e) => updateField(selectedEntity!.id, 'material.blendType', (e.target as HTMLSelectElement).value)}
              >
                {#each BLEND_TYPES as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Metadata section -->
      <div class="prop-section">
        <div class="prop-section-title">Metadata</div>
        <div class="prop-row">
          <label class="prop-label">Label</label>
          <input
            class="prop-text"
            type="text"
            value={selectedEntity.label ?? ''}
            onchange={(e) => updateField(selectedEntity!.id, 'label', (e.target as HTMLInputElement).value || undefined)}
          />
        </div>
        <div class="prop-row">
          <label class="prop-label">Weight</label>
          <input
            class="prop-slider"
            type="range"
            min="0" max="1" step="0.05"
            value={selectedEntity.weight ?? 0.5}
            oninput={(e) => updateField(selectedEntity!.id, 'weight', parseFloat((e.target as HTMLInputElement).value))}
          />
          <span class="prop-value">{(selectedEntity.weight ?? 0.5).toFixed(2)}</span>
        </div>
        <div class="prop-row">
          <label class="prop-label">Followable</label>
          <input
            type="checkbox"
            checked={selectedEntity.followable ?? false}
            onchange={(e) => updateField(selectedEntity!.id, 'followable', (e.target as HTMLInputElement).checked)}
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="prop-actions">
        <button class="remove-entity-btn" onclick={() => removeEntity(selectedEntity!.id)}>
          Remove Entity
        </button>
      </div>
    </div>
  {:else}
    <div class="empty-hint">Select an entity to edit</div>
  {/if}
</div>

<style>
  .property-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .entity-tree {
    display: flex;
    flex-direction: column;
    max-height: 100px;
    overflow-y: auto;
    scrollbar-width: thin;
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    padding: 2px;
  }

  .property-form {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 0;
    border-bottom: 1px solid var(--glass-border);
  }

  .prop-section:last-of-type {
    border-bottom: none;
  }

  .prop-section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pad-icon-muted);
  }

  .vec3-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .vec3-label {
    font-size: 10px;
    color: var(--pad-icon-muted);
    width: 30px;
    flex-shrink: 0;
  }

  .vec3-input {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 4px;
    padding: 2px 4px;
    min-width: 0;
    outline: none;
  }

  .vec3-input:focus {
    border-color: var(--accent);
  }

  .prop-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .prop-label {
    font-size: 10px;
    color: var(--pad-icon-muted);
    width: 52px;
    flex-shrink: 0;
  }

  .prop-select {
    flex: 1;
    font-family: var(--font-main);
    font-size: 10px;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 4px;
    padding: 2px 4px;
    outline: none;
  }

  .prop-text {
    flex: 1;
    font-family: var(--font-main);
    font-size: 10px;
    color: var(--pad-icon);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 4px;
    padding: 2px 4px;
    outline: none;
    min-width: 0;
  }

  .prop-text:focus,
  .prop-select:focus {
    border-color: var(--accent);
  }

  .prop-slider {
    flex: 1;
    height: 4px;
    min-width: 0;
    accent-color: var(--accent);
  }

  .prop-value {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 9px;
    color: var(--pad-icon-muted);
    width: 30px;
    text-align: right;
    flex-shrink: 0;
  }

  .prop-color {
    width: 24px;
    height: 20px;
    border: 1px solid var(--glass-border);
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    background: none;
  }

  .prop-actions {
    padding-top: 4px;
  }

  .remove-entity-btn {
    font-family: var(--font-main);
    font-size: 10px;
    color: #ef4444;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .remove-entity-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--pad-icon-muted);
    text-align: center;
    padding: 12px 0;
  }
</style>
