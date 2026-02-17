<script lang="ts">
  import type { Snippet } from 'svelte';
  import ConceptDetails from './ConceptDetails.svelte';
  import TextEditor from './TextEditor.svelte';
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
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-3" style="border-bottom: 1px solid var(--border)">
    <h2 class="text-sm font-medium truncate" style="color: var(--text-secondary)">{file?.title ?? 'No file selected'}</h2>
    <ExportMenu {file} />
  </div>

  <ConceptDetails {visualization} {focusedNodeId} {zoomLevel} />

  {#if embeddedControls}
    {@render embeddedControls()}
  {/if}

  <TextEditor
    {text}
    onchange={onTextChange}
    onvisualize={onVisualize}
    {loading}
    {autoSend}
    {onAutoSendToggle}
    {file}
  />
</div>
