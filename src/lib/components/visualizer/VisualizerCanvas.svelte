<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { renderVisualization } from './renderers';
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    error: string | null;
    loading: boolean;
    panTick?: number;
    panDx?: number;
    panDy?: number;
    zoomTick?: number;
    zoomDelta?: number;
    onNodeClick?: (nodeId: string) => void;
  }

  let { visualization, error, loading, panTick = 0, panDx = 0, panDy = 0, zoomTick = 0, zoomDelta = 1.2, onNodeClick }: Props = $props();

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;

  const PAN_STEP = 50;

  function render() {
    if (!svgEl || !visualization) return;
    const rect = containerEl.getBoundingClientRect();
    svgEl.setAttribute('width', String(rect.width));
    svgEl.setAttribute('height', String(rect.height));
    renderVisualization(svgEl, visualization);

    // Attach click handlers to nodes after rendering
    if (onNodeClick) {
      // Support both circle (graph/tree/hierarchy) and rect (flowchart) node elements
      const nodeElements = svgEl.querySelectorAll('circle, g.node rect');
      nodeElements.forEach((el) => {
        el.setAttribute('style', (el.getAttribute('style') || '') + ';cursor:pointer');
        el.addEventListener('click', (e) => {
          // For g.node children, data is on the parent g
          const dataEl = el.closest('g.node') || el;
          const data = (dataEl as any).__data__;
          if (data?.id) {
            onNodeClick(data.id);
          }
        });
      });
    }
  }

  function panBy(dx: number, dy: number) {
    if (!svgEl) return;
    const zoom = (svgEl as any).__d3Zoom;
    if (zoom) {
      zoom.translateBy(d3.select(svgEl), dx, dy);
    }
  }

  function zoomBy(factor: number) {
    if (!svgEl) return;
    const zoom = (svgEl as any).__d3Zoom;
    if (zoom) {
      zoom.scaleBy(d3.select(svgEl), factor);
    }
  }

  // React to pan commands
  let lastPanTick = 0;
  $effect(() => {
    if (panTick > lastPanTick) {
      panBy(panDx * PAN_STEP, panDy * PAN_STEP);
      lastPanTick = panTick;
    }
  });

  // React to zoom commands
  let lastZoomTick = 0;
  $effect(() => {
    if (zoomTick > lastZoomTick) {
      zoomBy(zoomDelta);
      lastZoomTick = zoomTick;
    }
  });

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
    <div class="absolute inset-0 flex items-center justify-center z-10" style="background: color-mix(in srgb, var(--canvas-bg) 70%, transparent)">
      <div class="flex items-center gap-2" style="color: var(--text-tertiary)">
        <div class="w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--border); border-top-color: var(--accent)"></div>
        <span class="text-sm">Generating visualization...</span>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center max-w-md">
        <p class="text-red-500 text-sm font-medium">Visualization Error</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary)">{error}</p>
      </div>
    </div>
  {/if}

  {#if !visualization && !loading && !error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center" style="color: var(--text-muted)">
        <p class="text-lg font-light">Concept Visualizer</p>
        <p class="text-sm mt-1">Write a concept in the editor and click Visualize</p>
      </div>
    </div>
  {/if}

  <svg bind:this={svgEl} class="w-full h-full"></svg>
</div>
