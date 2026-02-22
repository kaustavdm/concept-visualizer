<script lang="ts">
  import type { EntitySpec } from '$lib/3d/entity-spec';

  interface Props {
    entity: EntitySpec;
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
  }

  let { entity, depth, selectedId, onSelect }: Props = $props();

  let expanded = $state(false);
  let hasChildren = $derived((entity.children?.length ?? 0) > 0);
  let isSelected = $derived(selectedId === entity.id);

  const RENDER_ICONS: Record<string, string> = {
    sphere: '\u25CF',
    box: '\u25A0',
    plane: '\u25AD',
    cone: '\u25B2',
    cylinder: '\u25AE',
    torus: '\u25CB',
    capsule: '\u25CA',
  };

  let icon = $derived(RENDER_ICONS[entity.components?.render?.type ?? ''] ?? '\u25A1');
</script>

<div class="tree-item" style="padding-left: {depth * 12}px">
  <button
    class="tree-row"
    class:tree-selected={isSelected}
    onclick={() => onSelect(entity.id)}
  >
    {#if hasChildren}
      <button
        class="expand-toggle"
        onclick={(e: MouseEvent) => { e.stopPropagation(); expanded = !expanded; }}
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? '\u25BE' : '\u25B8'}
      </button>
    {:else}
      <span class="expand-spacer"></span>
    {/if}
    <span class="entity-icon">{icon}</span>
    <span class="entity-id" title={entity.id}>{entity.label ?? entity.id}</span>
  </button>
</div>

{#if expanded && entity.children}
  {#each entity.children as child (child.id)}
    <svelte:self
      entity={child}
      depth={depth + 1}
      {selectedId}
      {onSelect}
    />
  {/each}
{/if}

<style>
  .tree-item {
    display: flex;
    flex-direction: column;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--pad-icon);
    cursor: pointer;
    font-size: 11px;
    text-align: left;
    width: 100%;
    transition: background 0.12s;
  }

  .tree-row:hover {
    background: var(--pad-btn-bg);
  }

  .tree-row.tree-selected {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: none;
    background: transparent;
    color: var(--pad-icon-muted);
    cursor: pointer;
    padding: 0;
    font-size: 10px;
    flex-shrink: 0;
  }

  .expand-spacer {
    width: 14px;
    flex-shrink: 0;
  }

  .entity-icon {
    font-size: 10px;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .entity-id {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
</style>
