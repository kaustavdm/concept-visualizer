<script lang="ts">
  import type { VisualizationNode, VisualizationEdge } from '$lib/types';

  interface Props {
    node: VisualizationNode | null;
    x: number;
    y: number;
    edges: VisualizationEdge[];
    allNodes: VisualizationNode[];
  }

  let { node, x, y, edges, allNodes }: Props = $props();

  const connected = $derived(
    node
      ? edges
          .filter(e => e.source === node.id || e.target === node.id)
          .map(e => {
            const otherId = e.source === node.id ? e.target : e.source;
            return { node: allNodes.find(n => n.id === otherId), edgeLabel: e.label };
          })
          .filter(c => c.node)
      : []
  );

  const roleLabel: Record<string, string> = {
    central: 'Central',
    supporting: 'Supporting',
    contextual: 'Context',
    outcome: 'Outcome',
  };
</script>

{#if node}
  <div
    class="absolute z-30 pointer-events-none"
    style="left: {x}px; top: {y}px; transform: translate(-50%, -100%) translateY(-14px); max-width: 260px;"
  >
    <div
      class="rounded-xl px-3 py-2.5 text-sm"
      style="
        background: var(--glass-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      "
    >
      <div class="font-semibold mb-1 truncate" style="color: var(--text-primary)">{node.label}</div>

      {#if node.narrativeRole}
        <span
          class="inline-block px-1.5 py-0.5 rounded-full mb-2"
          style="background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); font-size: 10px"
        >{roleLabel[node.narrativeRole] ?? node.narrativeRole}</span>
      {/if}

      {#if node.details}
        <p class="leading-relaxed mb-2" style="color: var(--text-secondary); font-size: 11px">{node.details}</p>
      {/if}

      {#if connected.length > 0}
        <div style="border-top: 1px solid var(--border); padding-top: 6px; margin-top: 2px">
          {#each connected.slice(0, 5) as c}
            <div class="flex gap-1 leading-snug" style="color: var(--text-muted); font-size: 10px">
              <span style="color: var(--text-tertiary)">→</span>
              <span>{c.node?.label}</span>
              {#if c.edgeLabel}
                <span style="color: var(--text-tertiary)">({c.edgeLabel})</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
