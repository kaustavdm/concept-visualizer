<script lang="ts">
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    focusedNodeId?: string | null;
    zoomLevel?: number;
  }

  let { visualization, focusedNodeId = null, zoomLevel = 1 }: Props = $props();

  // Find the focused node and its connections
  const focusedNode = $derived(
    visualization?.nodes.find(n => n.id === focusedNodeId) ?? null
  );

  const connectedNodeIds = $derived.by(() => {
    if (!visualization || !focusedNodeId) return new Set<string>();
    const ids = new Set<string>();
    for (const edge of visualization.edges) {
      if (edge.source === focusedNodeId) ids.add(edge.target);
      if (edge.target === focusedNodeId) ids.add(edge.source);
    }
    return ids;
  });

  const filteredRelationships = $derived.by(() => {
    if (!visualization) return [];
    if (!focusedNodeId) return visualization.metadata.relationships;
    // Show relationships mentioning the focused node's label
    const label = focusedNode?.label?.toLowerCase() ?? '';
    return visualization.metadata.relationships.filter(
      r => r.toLowerCase().includes(label)
    );
  });

  // At very low zoom, show minimal info
  const isOverview = $derived(zoomLevel < 0.6);
</script>

{#if visualization}
  <div class="p-4 space-y-3">
    <div>
      <h2 class="font-semibold text-sm" style="font-family: var(--font-main); color: var(--text-primary)">
        {focusedNode ? focusedNode.label : visualization.title}
      </h2>
      <p class="text-xs mt-0.5" style="color: var(--text-tertiary)">
        {focusedNode?.details ?? visualization.description}
      </p>
    </div>

    {#if !isOverview && visualization.metadata.concepts.length > 0}
      <div>
        <h3 class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--text-tertiary)">Concepts</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each visualization.metadata.concepts as concept}
            {@const isFocused = focusedNode?.label === concept}
            {@const isConnected = !focusedNodeId || isFocused ||
              visualization.nodes.some(n => n.label === concept && connectedNodeIds.has(n.id))}
            <span
              class="inline-block px-2 py-0.5 text-xs rounded-full transition-opacity duration-200"
              style="
                background: {isFocused ? 'var(--accent)' : 'var(--accent-light)'};
                color: {isFocused ? 'white' : 'var(--accent-text)'};
                opacity: {isConnected ? 1 : 0.3};
              "
            >
              {concept}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if !isOverview && filteredRelationships.length > 0}
      <div>
        <h3 class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--text-tertiary)">Relationships</h3>
        <ul class="space-y-0.5">
          {#each filteredRelationships as rel}
            <li class="text-xs" style="color: var(--text-secondary)">{rel}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if isOverview}
      <p class="text-xs italic" style="color: var(--text-muted)">Zoom in to see details</p>
    {/if}
  </div>
{/if}
