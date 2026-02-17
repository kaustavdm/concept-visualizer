<script lang="ts">
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
  }

  let { text, visualization, loading, autoSend, file, onTextChange, onVisualize, onAutoSendToggle }: Props = $props();
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-3 border-b border-gray-200">
    <h2 class="text-sm font-medium text-gray-700 truncate">{file?.title ?? 'No file selected'}</h2>
    <ExportMenu {file} />
  </div>

  <ConceptDetails {visualization} />

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
