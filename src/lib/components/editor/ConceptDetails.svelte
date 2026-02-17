<script lang="ts">
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
  }

  let { visualization }: Props = $props();
</script>

{#if visualization}
  <div class="border-b border-gray-200 p-4 space-y-3">
    <div>
      <h2 class="font-semibold text-sm text-gray-900">{visualization.title}</h2>
      <p class="text-xs text-gray-500 mt-0.5">{visualization.description}</p>
    </div>

    {#if visualization.metadata.concepts.length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Concepts</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each visualization.metadata.concepts as concept}
            <span class="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
              {concept}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if visualization.metadata.relationships.length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Relationships</h3>
        <ul class="space-y-0.5">
          {#each visualization.metadata.relationships as rel}
            <li class="text-xs text-gray-600">{rel}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
