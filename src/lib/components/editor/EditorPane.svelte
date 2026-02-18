<script lang="ts">
  import type { Snippet } from 'svelte';
  import ConceptDetails from './ConceptDetails.svelte';
  import TextEditor from './TextEditor.svelte';
  import Panel from './Panel.svelte';
  import ExportMenu from '$lib/components/export/ExportMenu.svelte';
  import type { VisualizationSchema, ConceptFile } from '$lib/types';

  interface Props {
    text: string;
    visualization: VisualizationSchema | null;
    loading: boolean;
    autoSend: boolean;
    file: ConceptFile | undefined;
    onTextChange: (text: string) => void;
    onVisualize: () => void;
    onAutoSendToggle: (enabled: boolean) => void;
    focusedNodeId?: string | null;
    zoomLevel?: number;
    embeddedControls?: Snippet;
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
    focusedNodeId = null,
    zoomLevel = 1,
    embeddedControls
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
    />
  </Panel>
</div>
