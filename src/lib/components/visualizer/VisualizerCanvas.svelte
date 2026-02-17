<script lang="ts">
  import { onMount } from 'svelte';
  import { renderVisualization } from './renderers';
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    error: string | null;
    loading: boolean;
    onNodeClick?: (nodeId: string) => void;
  }

  let { visualization, error, loading, onNodeClick }: Props = $props();

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;

  function render() {
    if (!svgEl || !visualization) return;
    const rect = containerEl.getBoundingClientRect();
    svgEl.setAttribute('width', String(rect.width));
    svgEl.setAttribute('height', String(rect.height));
    renderVisualization(svgEl, visualization);

    // Attach click handlers to nodes after rendering
    if (onNodeClick) {
      const nodes = svgEl.querySelectorAll('circle');
      nodes.forEach((circle) => {
        circle.style.cursor = 'pointer';
        circle.addEventListener('click', (e) => {
          const data = (circle as any).__data__;
          if (data?.id) {
            onNodeClick(data.id);
          }
        });
      });
    }
  }

  $effect(() => {
    if (visualization) render();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => {
      if (visualization) render();
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div bind:this={containerEl} class="w-full h-full relative">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
      <div class="flex items-center gap-2 text-gray-500">
        <div class="w-5 h-5 border-2 border-gray-300 rounded-full animate-spin" style="border-top-color: var(--accent)"></div>
        <span class="text-sm">Generating visualization...</span>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center max-w-md">
        <p class="text-red-500 text-sm font-medium">Visualization Error</p>
        <p class="text-gray-500 text-xs mt-1">{error}</p>
      </div>
    </div>
  {/if}

  {#if !visualization && !loading && !error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-gray-400">
        <p class="text-lg font-light">Concept Visualizer</p>
        <p class="text-sm mt-1">Write a concept in the editor and click Visualize</p>
      </div>
    </div>
  {/if}

  <svg bind:this={svgEl} class="w-full h-full"></svg>
</div>
