<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import EditorPane from '$lib/components/editor/EditorPane.svelte';
  import VisualizerCanvas from '$lib/components/visualizer/VisualizerCanvas.svelte';
  import FileList from '$lib/components/files/FileList.svelte';
  import GamepadControls from '$lib/components/controls/GamepadControls.svelte';
  import { filesStore } from '$lib/stores/files';
  import { vizStore } from '$lib/stores/visualization';
  import { settingsStore } from '$lib/stores/settings';
  import { focusStore } from '$lib/stores/focus';
  import { createKeyboardController, type PadAction } from '$lib/controllers/keyboard';
  import { createExtractorRegistry } from '$lib/extractors/registry';
  import type { ExtractionEngineId } from '$lib/extractors/types';
  import type { ConceptFile, VisualizationType } from '$lib/types';
  import type { PlacementMode } from '$lib/components/controls/PlacementToggle.svelte';

  const VIZ_TYPES: VisualizationType[] = ['graph', 'tree', 'flowchart', 'hierarchy'];
  const ENGINE_ORDER: ExtractionEngineId[] = ['llm', 'nlp', 'keywords', 'semantic'];
  const ENGINE_LABELS: Record<ExtractionEngineId, string> = {
    llm: 'LLM',
    nlp: 'NLP (compromise)',
    keywords: 'Keywords (RAKE)',
    semantic: 'Semantic (TF.js)'
  };

  let activeFile: ConceptFile | undefined = $derived(
    $filesStore.files.find(f => f.id === $filesStore.activeFileId)
  );

  let activeActions = $state<Set<PadAction>>(new Set());
  let controlPlacement = $state<PlacementMode>('hud');
  let exportMenuOpen = $state(false);
  let autoSend = $derived(activeFile?.settings.autoSend ?? false);

  // Engine toast state
  let engineToast = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showEngineToast(name: string) {
    engineToast = name;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { engineToast = ''; }, 2000);
  }

  function cycleEngine() {
    const current = $settingsStore.extractionEngine as ExtractionEngineId;
    const idx = ENGINE_ORDER.indexOf(current);
    const next = ENGINE_ORDER[(idx + 1) % ENGINE_ORDER.length];
    settingsStore.update({ extractionEngine: next });
    showEngineToast(ENGINE_LABELS[next]);
  }

  // Track keyboard controller
  let kbController: ReturnType<typeof createKeyboardController> | null = null;

  // Extractor registry for engine-based visualization
  let registry = createExtractorRegistry({
    endpoint: $settingsStore.llmEndpoint,
    model: $settingsStore.llmModel
  });

  // Update LLM config when settings change
  $effect(() => {
    registry.updateLLMConfig({
      endpoint: $settingsStore.llmEndpoint,
      model: $settingsStore.llmModel
    });
  });

  function isTextInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ||
      (el as HTMLElement).isContentEditable;
  }

  function handleAction(action: PadAction) {
    // Flash the active state
    activeActions = new Set([...activeActions, action]);
    setTimeout(() => {
      activeActions = new Set([...activeActions].filter(a => a !== action));
    }, 150);

    switch (action) {
      case 'zoom_in':
        focusStore.zoomIn();
        break;
      case 'zoom_out':
        focusStore.zoomOut();
        break;
      case 'focus_up':
      case 'focus_left':
        focusStore.focusPrev();
        break;
      case 'focus_down':
      case 'focus_right':
        focusStore.focusNext();
        break;
      case 'fit_to_screen':
        focusStore.fitToScreen();
        break;
      case 'visualize':
        handleVisualize();
        break;
      case 'cycle_viz_type':
        cycleVizType();
        break;
      case 'cycle_engine':
        cycleEngine();
        break;
      case 'export':
        exportMenuOpen = !exportMenuOpen;
        break;
      case 'toggle_auto_send':
        if (activeFile) {
          const newAutoSend = !activeFile.settings.autoSend;
          filesStore.updateText(activeFile.id, activeFile.text);
        }
        break;
      case 'deselect':
        focusStore.clear();
        break;
      case 'pan_up':
      case 'pan_down':
      case 'pan_left':
      case 'pan_right':
        // Pan actions could be handled by D3 zoom transform if needed
        break;
    }
  }

  function cycleVizType() {
    const currentType = $vizStore.vizType ?? 'graph';
    const currentIdx = VIZ_TYPES.indexOf(currentType);
    const nextIdx = (currentIdx + 1) % VIZ_TYPES.length;
    const nextType = VIZ_TYPES[nextIdx];
    vizStore.setVizType(nextType);

    // Update body data attribute for theming
    document.body.setAttribute('data-viz-type', nextType);
  }

  onMount(async () => {
    await settingsStore.init();
    await filesStore.init();

    controlPlacement = $settingsStore.controlPlacement ?? 'hud';

    // Set theme data attribute
    document.body.setAttribute('data-theme', $settingsStore.theme);

    // Set initial viz type
    if ($vizStore.vizType) {
      document.body.setAttribute('data-viz-type', $vizStore.vizType);
    }

    // Set up keyboard controller
    kbController = createKeyboardController({
      onAction: handleAction,
      isTextInputFocused
    });
    kbController.attach();

    return () => {
      kbController?.detach();
    };
  });

  // React to settings changes for theme
  $effect(() => {
    if ($settingsStore.theme) {
      document.body.setAttribute('data-theme', $settingsStore.theme);
    }
  });

  // React to viz type changes
  $effect(() => {
    if ($vizStore.vizType) {
      document.body.setAttribute('data-viz-type', $vizStore.vizType);
    }
  });

  // React to placement setting changes
  $effect(() => {
    controlPlacement = $settingsStore.controlPlacement ?? 'hud';
  });

  // When visualization loads, set node IDs for focus store
  $effect(() => {
    if ($vizStore.current) {
      focusStore.setNodeIds($vizStore.current.nodes.map(n => n.id));
    }
  });

  async function handleVisualize() {
    if (!activeFile || !activeFile.text.trim()) return;

    vizStore.setLoading();
    try {
      const engineId = $settingsStore.extractionEngine as ExtractionEngineId;
      const engine = registry.getEngine(engineId);
      const viz = await engine.extract(activeFile.text);
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
    focusStore.clear();
  }

  function handleSelectFile(id: string) {
    filesStore.setActive(id);
    const file = $filesStore.files.find(f => f.id === id);
    if (file?.visualization) {
      vizStore.setVisualization(file.visualization);
    } else {
      vizStore.clear();
    }
    focusStore.clear();
  }

  function handleNodeClick(nodeId: string) {
    focusStore.focusNode(nodeId);
  }

  function handlePlacementChange(mode: PlacementMode) {
    controlPlacement = mode;
    settingsStore.update({ controlPlacement: mode });
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
      onNodeClick={handleNodeClick}
    />
    {#if controlPlacement === 'hud'}
      <GamepadControls
        {activeActions}
        onAction={handleAction}
        vizType={$vizStore.vizType}
        autoSendOn={autoSend}
        placement="hud"
        onPlacementChange={handlePlacementChange}
      />
    {/if}
  {/snippet}

  {#snippet dock()}
    {#if controlPlacement === 'dock'}
      <GamepadControls
        {activeActions}
        onAction={handleAction}
        vizType={$vizStore.vizType}
        autoSendOn={autoSend}
        placement="dock"
        onPlacementChange={handlePlacementChange}
      />
    {/if}
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
      focusedNodeId={$focusStore.focusedNodeId}
      zoomLevel={$focusStore.zoomLevel}
    >
      {#snippet embeddedControls()}
        {#if controlPlacement === 'embedded'}
          <GamepadControls
            {activeActions}
            onAction={handleAction}
            vizType={$vizStore.vizType}
            autoSendOn={autoSend}
            placement="embedded"
            onPlacementChange={handlePlacementChange}
          />
        {/if}
      {/snippet}
    </EditorPane>
  {/snippet}
</AppShell>

{#if engineToast}
  <div
    class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg"
    style="background: var(--accent, #3b82f6); color: white;"
    role="status"
    aria-live="polite"
  >
    Engine: {engineToast}
  </div>
{/if}
