<script lang="ts">
  import type { VisualizationType } from '$lib/types';
  import type { ExtractionEngineId } from '$lib/extractors/types';
  import type { PipelineStage, PipelineRecommendation } from '$lib/pipeline/types';
  import { vizStore } from '$lib/stores/visualization';

  interface Props {
    vizType: VisualizationType;
    engineId: ExtractionEngineId;
    onVizTypeChange: (type: VisualizationType) => void;
    onEngineChange: (id: ExtractionEngineId) => void;
    pipelineStage: PipelineStage;
    recommendation: PipelineRecommendation | null;
  }

  let { vizType, engineId, onVizTypeChange, onEngineChange, pipelineStage, recommendation }: Props = $props();

  const VIZ_TYPES: { id: VisualizationType; label: string }[] = [
    { id: 'graph', label: 'Graph' },
    { id: 'tree', label: 'Tree' },
    { id: 'flowchart', label: 'Flow' },
    { id: 'hierarchy', label: 'Hierarchy' },
    { id: 'logicalflow', label: 'Logic' },
    { id: 'storyboard', label: 'Story' }
  ];

  const ENGINES: { id: ExtractionEngineId; label: string }[] = [
    { id: 'llm', label: 'LLM' },
    { id: 'nlp', label: 'NLP' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'semantic', label: 'Semantic' }
  ];

  const STAGE_LABELS: Partial<Record<PipelineStage, string>> = {
    analyzing: 'Analyzing\u2026',
    refining: 'Refining\u2026',
    extracting: 'Extracting\u2026',
    rendering: 'Rendering\u2026'
  };

  let stageLabel = $derived(STAGE_LABELS[pipelineStage] ?? null);
  let isActive = $derived(pipelineStage !== 'idle' && pipelineStage !== 'complete' && pipelineStage !== 'error');
</script>

<div class="flex flex-col gap-2 px-3 py-2">
  <!-- Viz Type Row -->
  <div>
    <span class="text-[10px] font-semibold uppercase tracking-widest block mb-1" style="color: var(--text-muted)">Style</span>
    <div class="flex flex-wrap gap-1">
      {#each VIZ_TYPES as vt}
        <button
          class="text-[11px] px-2 py-1 rounded-md font-medium transition-colors"
          style={vizType === vt.id
            ? 'background: var(--accent); color: white;'
            : 'background: var(--surface-bg); color: var(--text-secondary); border: 1px solid var(--border);'}
          onclick={() => onVizTypeChange(vt.id)}
        >
          {vt.label}
          {#if recommendation && recommendation.type === vt.id && vizType !== vt.id}
            <span class="ml-0.5" title="Recommended">&#9733;</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Engine Row -->
  <div>
    <span class="text-[10px] font-semibold uppercase tracking-widest block mb-1" style="color: var(--text-muted)">Engine</span>
    <div class="flex flex-wrap gap-1">
      {#each ENGINES as eng}
        <button
          class="text-[11px] px-2 py-1 rounded-md font-medium transition-colors"
          style={engineId === eng.id
            ? 'background: var(--accent); color: white;'
            : 'background: var(--surface-bg); color: var(--text-secondary); border: 1px solid var(--border);'}
          onclick={() => onEngineChange(eng.id)}
        >
          {eng.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Storyboard Orientation (conditional) -->
  {#if vizType === 'storyboard'}
    <div class="flex items-center gap-2" style="color: var(--text-tertiary)">
      <span class="text-[10px] font-semibold uppercase tracking-widest" style="color: var(--text-muted)">Orientation</span>
      <button
        onclick={() => vizStore.setStoryboardOrientation($vizStore.storyboardOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
        class="text-[11px] px-2 py-0.5 rounded font-mono"
        style="border: 1px solid var(--border); color: var(--text-secondary)"
      >
        {$vizStore.storyboardOrientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
      </button>
    </div>
  {/if}

  <!-- Pipeline Status Line -->
  {#if isActive && stageLabel}
    <div class="flex items-center gap-1.5 text-[11px]" style="color: var(--text-tertiary)">
      <div class="w-3 h-3 border border-current rounded-full animate-spin" style="border-top-color: var(--accent)"></div>
      <span>{stageLabel}</span>
    </div>
  {:else if recommendation && (pipelineStage === 'idle' || pipelineStage === 'complete')}
    <div class="text-[11px]" style="color: var(--text-muted)">
      &#9733; Recommended: <span class="font-medium" style="color: var(--text-secondary)">{recommendation.type}</span>
    </div>
  {/if}
</div>
