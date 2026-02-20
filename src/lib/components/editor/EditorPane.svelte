<script lang="ts">
  import type { Snippet } from 'svelte';
  import ConceptDetails from './ConceptDetails.svelte';
  import TextEditor from './TextEditor.svelte';
  import Panel from './Panel.svelte';
  import StylePanel from './StylePanel.svelte';
  import ExportMenu from '$lib/components/export/ExportMenu.svelte';
  import type { VisualizationSchema, VisualizationType, ConceptFile } from '$lib/types';
  import type { ExtractionEngineId } from '$lib/extractors/types';
  import type { PipelineStage, PipelineRecommendation } from '$lib/pipeline/types';

  interface Props {
    text: string;
    visualization: VisualizationSchema | null;
    loading: boolean;
    autoSend: boolean;
    file: ConceptFile | undefined;
    onTextChange: (text: string) => void;
    onVisualize: () => void;
    onAutoSendToggle: (enabled: boolean) => void;
    isFromCache?: boolean;
    onReextract?: () => void;
    focusedNodeId?: string | null;
    zoomLevel?: number;
    embeddedControls?: Snippet;
    vizType: VisualizationType;
    engineId: ExtractionEngineId;
    onVizTypeChange: (type: VisualizationType) => void;
    onEngineChange: (id: ExtractionEngineId) => void;
    pipelineStage: PipelineStage;
    recommendation: PipelineRecommendation | null;
  }

  let {
    text,
    visualization,
    loading,
    autoSend,
    file,
    onTextChange,
    onVisualize,
    onAutoSendToggle,
    isFromCache = false,
    onReextract,
    focusedNodeId = null,
    zoomLevel = 1,
    embeddedControls,
    vizType,
    engineId,
    onVizTypeChange,
    onEngineChange,
    pipelineStage,
    recommendation
  }: Props = $props();

  const contextBadge = $derived(
    visualization
      ? (visualization.metadata.concepts.length + visualization.metadata.relationships.length) || null
      : null
  );
</script>

<div class="flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between p-3 flex-shrink-0" style="border-bottom: 1px solid var(--border)">
    <h2 class="text-sm font-medium truncate" style="color: var(--text-secondary)">{file?.title ?? 'No file selected'}</h2>
    <ExportMenu {file} />
  </div>

  {#if visualization}
    <div class="flex-shrink-0 overflow-hidden" style="max-height: 45%">
      <Panel title="Context" badge={contextBadge}>
        <ConceptDetails {visualization} {focusedNodeId} {zoomLevel} />
      </Panel>
    </div>
  {/if}

  <Panel title="Visualization" defaultOpen={true}>
    <StylePanel
      {vizType}
      {engineId}
      {onVizTypeChange}
      {onEngineChange}
      {pipelineStage}
      {recommendation}
    />
  </Panel>

  {#if embeddedControls}
    <div class="flex-shrink-0">
      {@render embeddedControls()}
    </div>
  {/if}

  <Panel title="Input" fill>
    <TextEditor
      {text}
      onchange={onTextChange}
      onvisualize={onVisualize}
      {loading}
      {autoSend}
      {onAutoSendToggle}
      {file}
      {isFromCache}
      {onReextract}
    />
  </Panel>
</div>
