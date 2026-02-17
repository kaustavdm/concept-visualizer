<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import EditorPane from '$lib/components/editor/EditorPane.svelte';
  import VisualizerCanvas from '$lib/components/visualizer/VisualizerCanvas.svelte';
  import FileList from '$lib/components/files/FileList.svelte';
  import { filesStore } from '$lib/stores/files';
  import { vizStore } from '$lib/stores/visualization';
  import { settingsStore } from '$lib/stores/settings';
  import { generateVisualization } from '$lib/llm/client';
  import type { ConceptFile } from '$lib/types';

  let activeFile: ConceptFile | undefined = $derived(
    $filesStore.files.find(f => f.id === $filesStore.activeFileId)
  );

  onMount(async () => {
    await settingsStore.init();
    await filesStore.init();
  });

  async function handleVisualize() {
    if (!activeFile || !activeFile.text.trim()) return;

    vizStore.setLoading();
    try {
      const viz = await generateVisualization(activeFile.text, {
        endpoint: $settingsStore.llmEndpoint,
        model: $settingsStore.llmModel
      });
      vizStore.setVisualization(viz);
      await filesStore.updateVisualization(activeFile.id, viz);
    } catch (err) {
      vizStore.setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleTextChange(text: string) {
    if (activeFile) {
      filesStore.updateText(activeFile.id, text);
    }
  }

  async function handleCreateFile() {
    await filesStore.create('Untitled Concept');
    vizStore.clear();
  }

  function handleSelectFile(id: string) {
    filesStore.setActive(id);
    const file = $filesStore.files.find(f => f.id === id);
    if (file?.visualization) {
      vizStore.setVisualization(file.visualization);
    } else {
      vizStore.clear();
    }
  }
</script>

<AppShell>
  {#snippet sidebar()}
    <FileList
      files={$filesStore.files}
      activeFileId={$filesStore.activeFileId}
      onSelect={handleSelectFile}
      onCreate={handleCreateFile}
      onRename={(id, title) => filesStore.rename(id, title)}
      onDelete={(id) => filesStore.remove(id)}
    />
  {/snippet}

  {#snippet main()}
    <VisualizerCanvas
      visualization={$vizStore.current}
      error={$vizStore.error}
      loading={$vizStore.loading}
    />
  {/snippet}

  {#snippet editor()}
    <EditorPane
      text={activeFile?.text ?? ''}
      visualization={$vizStore.current}
      loading={$vizStore.loading}
      autoSend={activeFile?.settings.autoSend ?? false}
      file={activeFile}
      onTextChange={handleTextChange}
      onVisualize={handleVisualize}
      onAutoSendToggle={(enabled) => {
        if (activeFile) {
          filesStore.updateText(activeFile.id, activeFile.text);
        }
      }}
    />
  {/snippet}
</AppShell>
