<script lang="ts">
  import { onMount } from 'svelte';
  import { pushState } from '$app/navigation';
  import { page } from '$app/stores';
  import { settingsStore } from '$lib/stores/settings';
  import type { SceneController, CameraMode } from '$lib/3d/createScene';
  import { files3dStore } from '$lib/stores/files3d';
  import { composeLayers } from '$lib/3d/compositor';
  import { solarLayers } from '$lib/3d/scenes/solar';
  import MovementDial from '$lib/components/3d/MovementDial.svelte';
  import HexagonDial from '$lib/components/3d/HexagonDial.svelte';
  import KeyboardHelp from '$lib/components/3d/KeyboardHelp.svelte';
  import SettingsModal from '$lib/components/3d/SettingsModal.svelte';
  import OnboardingModal from '$lib/components/3d/OnboardingModal.svelte';
  import LayersPanel from '$lib/components/3d/LayersPanel.svelte';
  import FileBrowserHex from '$lib/components/3d/FileBrowserHex.svelte';
  import FileListModal from '$lib/components/3d/FileListModal.svelte';
  import StatusBar from '$lib/components/3d/StatusBar.svelte';
  import ChatInput from '$lib/components/3d/ChatInput.svelte';
  import { routeKeyDown, shouldProcessKeyUp, shouldAutoEnterInputMode } from '$lib/3d/input-mode';
  import { SCENE_BAY, APP_BAY, DEFAULT_SELECTIONS } from '$lib/components/3d/hexagon-dial-bays';
  import type { EntitySpec, Layer3d, Scene3d } from '$lib/3d/entity-spec';
  import { createObservationModeRegistry } from '$lib/3d/observation-modes/registry';
  import { graphMode } from '$lib/3d/observation-modes/graph';
  import { moralityMode } from '$lib/3d/observation-modes/morality';
  import { ontologyMode } from '$lib/3d/observation-modes/ontology';
  import { epistemologyMode } from '$lib/3d/observation-modes/epistemology';
  import { causalityMode } from '$lib/3d/observation-modes/causality';
  import { debateMode } from '$lib/3d/observation-modes/debate';
  import { appearanceMode } from '$lib/3d/observation-modes/appearance';
  import { createPipelineBridge } from '$lib/3d/pipeline-bridge';
  import type { PipelineBridge, TieredBridgeResult } from '$lib/3d/pipeline-bridge';
  import { createTieredRunner } from '$lib/pipeline/runner';
  import { tier1Extract } from '$lib/pipeline/tiers/tier1-extract';
  import { createTier2 } from '$lib/pipeline/tiers/tier2-refine';
  import { createTier3 } from '$lib/pipeline/tiers/tier3-enrich';
  import type { PipelineStage } from '$lib/pipeline/types';
  import { generateEntities } from '$lib/llm/entity-gen';
  import { insertBetween } from '$lib/utils/fractional-index';
  import { get } from 'svelte/store';
  import { v4 as uuid } from 'uuid';

  let canvas: HTMLCanvasElement;
  let scene: SceneController | null = $state(null);
  let cameraMode: CameraMode = $state('orbit');
  let theme: 'light' | 'dark' = $state('light');
  let themeMode: 'system' | 'light' | 'dark' = $state('system');
  let shiftHeld = $state(false);
  let controlsVisible = $state(true);
  let compassAngle = $state(0);
  let dialActivateFace: string | null = $state(null);
  let dialActivateCenter = $state(false);
  let dialActivateOption: number | null = $state(null);
  let dialDismiss = $state(false);
  let keyActiveActions = $state(new Set<string>());
  let fileListVisible = $state(false);
  let layersPanelVisible = $state(true);
  let storeFiles: Scene3d[] = $state([]);
  let storeActiveFileId: string | null = $state(null);
  let activeLayers: Layer3d[] = $state([]);
  let inputMode = $state(false);
  let currentFps = $state(0);
  let statusBarConfig = $state({
    fps: false,
    mode: true,
    movement: true,
    filename: true,
    bar: true,
    observation: true,
  });
  let showOnboarding = $state(false);
  let isProcessing = $state(false);
  let pipelineError: string | null = $state(null);
  let generateLoading = $state(false);
  let pipelineErrorTimer: ReturnType<typeof setTimeout> | null = null;

  // Modal state derived from shallow routing
  let activeModal = $derived(($page as any).state?.modal as string | undefined);
  let helpVisible = $derived(activeModal === 'help');
  let settingsVisible = $derived(activeModal === 'settings');

  // Observation mode registry
  const modeRegistry = createObservationModeRegistry();
  modeRegistry.register(graphMode);
  modeRegistry.register(moralityMode);
  modeRegistry.register(ontologyMode);
  modeRegistry.register(epistemologyMode);
  modeRegistry.register(causalityMode);
  modeRegistry.register(debateMode);
  modeRegistry.register(appearanceMode);
  const prefabRegistry = modeRegistry.buildPrefabRegistry();
  let activeMode = $state('graph');
  let activeFileName = $derived(
    storeFiles.find(f => f.id === storeActiveFileId)?.title ?? null
  );

  // Pipeline bridge: connects tiered extraction to observation modes
  let bridge: PipelineBridge | null = null;
  let pipelineStage: PipelineStage = $state('idle');

  function initPipelineBridge() {
    const settings = get(settingsStore);

    const tier2 = settings.tier2Enabled ? createTier2() : null;
    const tier3 = settings.tier3Enabled ? createTier3({
      llmConfig: { endpoint: settings.llmEndpoint, model: settings.llmModel },
      enrichmentLevel: settings.llmEnrichmentLevel,
      modeRoles: modeRegistry.getMode(activeMode)?.roles,
      storyFocus: modeRegistry.getMode(activeMode)?.storyFocus,
    }) : null;

    const runner = createTieredRunner({
      tier1: tier1Extract,
      tier2,
      tier3,
    });

    bridge = createPipelineBridge(runner, modeRegistry);
  }

  function showPipelineError(msg: string) {
    pipelineError = msg;
    if (pipelineErrorTimer) clearTimeout(pipelineErrorTimer);
    pipelineErrorTimer = setTimeout(() => { pipelineError = null; }, 5000);
  }

  function resolveSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(resolved: 'light' | 'dark') {
    theme = resolved;
    scene?.setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    settingsStore.update({ theme: resolved });
  }

  // Modal navigation helpers
  function openHelp() {
    pushState('/help', { modal: 'help' });
  }

  function openSettings() {
    pushState('/settings', { modal: 'settings' });
  }

  function closeModal() {
    history.back();
  }

  // Multi-bay state
  const dialBays = [SCENE_BAY, APP_BAY];
  let activeBayIndex = $state(0);
  let dialHasFanOpen = $state(false);
  let openFanFace: string | null = $state(null);
  let followTarget: string | null = $state(null);
  let dialSelections = $state<Record<string, string>>({ ...DEFAULT_SELECTIONS });

  // Dynamic key map: position keys → face IDs for the active bay
  const POSITION_KEYS = ['o', ';', '.', ',', 'm', 'k'];
  let dialKeyMap = $derived(
    Object.fromEntries(POSITION_KEYS.map((key, i) => [key, dialBays[activeBayIndex].faces[i].id]))
  );

  onMount(() => {
    // Read default observation mode from saved settings
    const savedSettings = get(settingsStore);
    if (savedSettings.defaultObservationMode) {
      activeMode = savedSettings.defaultObservationMode;
    }

    // Initialize pipeline bridge for LLM extraction
    initPipelineBridge();

    // Resolve initial theme: default to system detection
    const initialTheme = resolveSystemTheme();
    applyTheme(initialTheme);

    let raf: number;
    let destroyed = false;

    // Dynamic import: PlayCanvas loads as a separate chunk (~2 MB)
    import('$lib/3d/createScene').then(({ createScene }) => {
      if (destroyed) return;
      const s = createScene(canvas, initialTheme);
      scene = s;

      function tick() {
        compassAngle = s.getCompassAngle();
        currentFps = s.getFps();
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      // If store loaded before PlayCanvas, sync content now
      syncFromStore();
    });

    // Initialize 3D file store (independent of PlayCanvas)
    files3dStore.init().then(async () => {
      const state = get(files3dStore);
      if (state.files.length === 0) {
        // First launch — show onboarding if not yet completed
        const settings = get(settingsStore);
        if (!settings.onboardingCompleted) {
          showOnboarding = true;
        } else {
          // Onboarding completed previously but files were cleared — recreate default
          const file = await files3dStore.create('Terran System');
          await files3dStore.updateLayers(file.id, structuredClone(solarLayers));
        }
      } else {
        // Migrate existing default scene: ensure floor entity has grid property
        // (was lost during DSL redesign, causes solid plane instead of grid mesh)
        const defaultFile = state.files.find(f => f.title === 'Terran System');
        if (defaultFile) {
          const ground = defaultFile.layers.find(l => l.id === 'ground');
          const floor = ground?.entities.find(e => e.id === 'floor');
          if (floor?.components?.render && !floor.components.render.grid) {
            floor.components.render.grid = { tiling: 4 };
            await files3dStore.updateLayers(defaultFile.id, structuredClone(defaultFile.layers));
          }
        }
      }
      syncFromStore();
    });

    const unsub3d = files3dStore.subscribe(() => {
      syncFromStore();
    });

    // Listen for OS dark/light preference changes (only applies in system mode)
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onSystemChange() {
      if (themeMode === 'system') {
        applyTheme(resolveSystemTheme());
      }
    }
    mql.addEventListener('change', onSystemChange);

    // Sync from settings store — only update if not in system mode
    const unsub = settingsStore.subscribe((settings) => {
      if (themeMode !== 'system') {
        theme = settings.theme;
        scene?.setTheme(settings.theme);
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
      // Re-init bridge with latest settings
      initPipelineBridge();
    });

    return () => {
      destroyed = true;
      mql.removeEventListener('change', onSystemChange);
      unsub();
      unsub3d();
      cancelAnimationFrame(raf);
      scene?.destroy();
      scene = null;
    };
  });

  /** Extract plain layers from reactive state (avoids deep type inference with $state.snapshot) */
  function plainLayers(): Layer3d[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return $state.snapshot(activeLayers as any) as Layer3d[];
  }

  function syncFromStore() {
    const state = get(files3dStore);
    storeFiles = state.files;
    storeActiveFileId = state.activeFileId;
    const activeFile = state.files.find(f => f.id === state.activeFileId);
    if (activeFile) {
      activeLayers = activeFile.layers;
      const content = composeLayers(activeFile.layers, activeFile.id, prefabRegistry);
      scene?.loadContent(content);
    }
  }

  function handleToggleVisibility(layerId: string) {
    const plain = plainLayers();
    const updated = plain.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  function handleUpdateText(layerId: string, text: string) {
    const plain = plainLayers();
    const updated = plain.map(l =>
      l.id === layerId ? { ...l, text, updatedAt: new Date().toISOString() } : l
    );
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  function handleUpdateEntities(layerId: string, entities: EntitySpec[]) {
    const plain = plainLayers();
    const updated = plain.map(l =>
      l.id === layerId ? { ...l, entities, updatedAt: new Date().toISOString() } : l
    );
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  function handleAddLayer() {
    const plain = plainLayers();
    const positions = plain.map(l => l.position);
    const lastPos = positions.length > 0 ? positions.sort().pop() : undefined;
    const newPosition = insertBetween(lastPos, undefined);
    const now = new Date().toISOString();
    const newLayer: Layer3d = {
      id: uuid(),
      name: `Layer ${plain.length + 1}`,
      visible: true,
      text: '',
      entities: [],
      position: newPosition,
      source: { type: 'manual' },
      createdAt: now,
      updatedAt: now,
    };
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, [...plain, newLayer]);
  }

  function handleRemoveLayer(layerId: string) {
    const plain = plainLayers();
    const updated = plain.filter(l => l.id !== layerId);
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  async function handleChatSubmit(text: string) {
    if (!bridge) {
      showPipelineError('Pipeline not initialized. Check your settings.');
      return;
    }
    isProcessing = true;
    pipelineError = null;
    const messageId = uuid();

    // Pre-message snapshot
    if (storeActiveFileId) {
      await files3dStore.addSnapshot(storeActiveFileId, `Before: ${text.slice(0, 80)}`, 0, messageId);
    }

    let lastResult: TieredBridgeResult | undefined;

    try {
      // Accumulate only the final tier result — avoids flashing intermediate renders
      for await (const result of bridge.process(text, activeMode, { theme }, (stage) => {
        pipelineStage = stage;
      })) {
        lastResult = result;
      }

      // Add layers from the final result only
      if (lastResult) {
        const plain = plainLayers();
        let currentLayers = [...plain];

        for (const layer of lastResult.layers) {
          const positions = currentLayers.map(l => l.position);
          const lastPos = positions.length > 0 ? positions.sort().pop() : undefined;
          layer.position = insertBetween(lastPos, undefined);
          layer.source = { type: 'chat', messageId };
          currentLayers = [...currentLayers, layer];
        }

        activeLayers = currentLayers;

        // Persist layers and snapshot
        if (storeActiveFileId) {
          await files3dStore.updateLayers(storeActiveFileId, plainLayers());
          await files3dStore.addSnapshot(storeActiveFileId, `Tier ${lastResult.tier}`, lastResult.tier, messageId);
        }
      }

      // Persist chat message with cached schema
      if (storeActiveFileId && lastResult) {
        const layerIds = activeLayers
          .filter(l => l.source.type === 'chat' && l.source.messageId === messageId)
          .map(l => l.id);

        await files3dStore.addMessage(storeActiveFileId, {
          id: messageId,
          text,
          timestamp: new Date().toISOString(),
          layerIds,
          observationMode: activeMode,
          schema: lastResult.schema,
        });
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Pipeline aborted') {
        pipelineStage = 'interrupted';
      } else {
        const msg = e instanceof Error ? e.message : 'Extraction failed';
        showPipelineError(msg);
        pipelineStage = 'error';
      }
    } finally {
      isProcessing = false;
    }
  }

  async function handleGenerate(layerId: string, text: string) {
    generateLoading = true;
    try {
      const settings = get(settingsStore);
      const entities = await generateEntities(text, {
        endpoint: settings.llmEndpoint,
        model: settings.llmModel,
      });
      const plain = plainLayers();
      const updated = plain.map(l =>
        l.id === layerId
          ? { ...l, entities, updatedAt: new Date().toISOString() }
          : l
      );
      if (storeActiveFileId) await files3dStore.updateLayers(storeActiveFileId, updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      showPipelineError(msg);
    } finally {
      generateLoading = false;
    }
  }

  // File browser callbacks
  async function handleCreateFile() {
    await files3dStore.create('Untitled Scene');
  }

  function handleSelectFile(id: string) {
    files3dStore.setActive(id);
  }

  async function handleDeleteFile(id: string) {
    await files3dStore.remove(id);
  }

  async function handleCloneFile() {
    if (!storeActiveFileId) return;
    const activeFile = storeFiles.find(f => f.id === storeActiveFileId);
    if (!activeFile) return;
    const copy = await files3dStore.create(activeFile.title + ' (copy)');
    const layers = plainLayers();
    await files3dStore.updateLayers(copy.id, layers);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;

    // Route through input mode controller
    const route = routeKeyDown(e.key, { inputMode, helpVisible: helpVisible || settingsVisible, fileListVisible });
    switch (route.action) {
      case 'close_help': if (helpVisible || settingsVisible) closeModal(); return;
      case 'close_file_list': fileListVisible = false; return;
      case 'exit_input_mode': inputMode = false; return;
      case 'enter_input_mode': inputMode = true; return;
      case 'blocked': return;
      // 'passthrough' → continue to command mode handlers below
    }

    // --- Command mode only below ---

    // '?' toggles help overlay (Shift+/ on US layout)
    if (e.key === '?') {
      if (helpVisible) closeModal();
      else openHelp();
      return;
    }

    if (e.key === 'Escape') {
      dialDismiss = true;
      requestAnimationFrame(() => { dialDismiss = false; });
      return;
    }

    // When camera fan is open, 'f' selects follow mode instead of fullscreen
    if (e.key.toLowerCase() === 'f' && dialHasFanOpen && openFanFace === 'camera') {
      handleDialSelect('camera', 'follow');
      dialDismiss = true;
      requestAnimationFrame(() => { dialDismiss = false; });
      return;
    }

    if (e.key.toLowerCase() === 'f') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      return;
    }

    // Space: cycle follow target (only in follow mode)
    if (e.key === ' ' && cameraMode === 'follow') {
      e.preventDefault();
      followTarget = scene?.cycleFollowTarget() ?? null;
      return;
    }

    if (e.key.toLowerCase() === 'h') {
      controlsVisible = !controlsVisible;
      return;
    }

    if (e.key.toLowerCase() === 'c') {
      scene?.lookAtOrigin();
      return;
    }

    if (e.key === 'Shift') {
      shiftHeld = true;
      scene?.setInput('shift', true);
      return;
    }

    const map: Record<string, string> = {
      w: 'pan_up',
      a: 'pan_left',
      s: 'pan_down',
      d: 'pan_right',
      z: 'zoom_in',
      x: 'zoom_out',
    };
    const action = map[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      scene?.setInput(action, true);
      keyActiveActions = new Set([...keyActiveActions, action]);
      return;
    }

    // HexagonDial face shortcuts — derived from active bay
    const face = dialKeyMap[e.key.toLowerCase()];
    if (face) {
      const faceDef = dialBays[activeBayIndex].faces.find(f => f.id === face);
      dialActivateFace = face;
      // Faces with no fan-out options: trigger toggle directly
      if (faceDef && faceDef.options.length === 0) {
        handleDialToggle(face);
      } else {
        openFanFace = face;
      }
      requestAnimationFrame(() => { dialActivateFace = null; });
      return;
    }

    // L key: switch bay (center action)
    if (e.key.toLowerCase() === 'l') {
      dialActivateCenter = true;
      requestAnimationFrame(() => { dialActivateCenter = false; });
      return;
    }

    // Number keys 1-9: select fan-out option by index (only when fan is open)
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9 && dialHasFanOpen) {
      dialActivateOption = num - 1;
      requestAnimationFrame(() => { dialActivateOption = null; });
      return;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!shouldProcessKeyUp({ inputMode, helpVisible: helpVisible || settingsVisible, fileListVisible })) return;

    if (e.key === 'Shift') {
      shiftHeld = false;
      scene?.setInput('shift', false);
      return;
    }

    const map: Record<string, string> = {
      w: 'pan_up',
      a: 'pan_left',
      s: 'pan_down',
      d: 'pan_right',
      z: 'zoom_in',
      x: 'zoom_out',
    };
    const action = map[e.key.toLowerCase()];
    if (action) {
      scene?.setInput(action, false);
      const next = new Set(keyActiveActions);
      next.delete(action);
      keyActiveActions = next;
    }
  }

  function handleInputStart(action: string) {
    scene?.setInput(action, true);
  }

  function handleInputEnd(action: string) {
    scene?.setInput(action, false);
  }

  function handleLookAtOrigin() {
    scene?.lookAtOrigin();
  }

  function toggleTheme() {
    const order: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
    const idx = order.indexOf(themeMode);
    const next = order[(idx + 1) % order.length];
    handleDialSelect('theme', next);
  }

  function handleDialSelect(faceId: string, optionId: string) {
    dialSelections = { ...dialSelections, [faceId]: optionId };

    // Status face: toggle individual status bar elements
    if (faceId === 'status') {
      const key = optionId as keyof typeof statusBarConfig;
      if (key in statusBarConfig) {
        statusBarConfig = { ...statusBarConfig, [key]: !statusBarConfig[key] };
      }
      return;
    }

    // Scenes face: actions (not a persistent selection)
    if (faceId === 'scenes') {
      if (optionId === 'new') handleCreateFile();
      else if (optionId === 'clone') handleCloneFile();
      else if (optionId === 'list') { fileListVisible = true; }
      return;
    }

    // Observation mode selection
    if (faceId === 'observation') {
      activeMode = optionId;
      initPipelineBridge();
      return;
    }

    // Scene bay actions
    if (faceId === 'theme') {
      themeMode = optionId as 'system' | 'light' | 'dark';
      if (optionId === 'system') {
        applyTheme(resolveSystemTheme());
      } else {
        applyTheme(optionId as 'light' | 'dark');
      }
    } else if (faceId === 'camera') {
      scene?.setCameraMode(optionId as CameraMode);
      cameraMode = optionId as CameraMode;
    }
    // App bay actions are dummy for now — selections are tracked but not wired
  }

  function handleDialToggle(faceId: string) {
    if (faceId === 'theme') {
      toggleTheme();
    } else if (faceId === 'settings') {
      openSettings();
    }
    // App bay toggles (pipeline, refinement) are dummy for now
  }

  function handleBayChange(nextIndex: number) {
    activeBayIndex = nextIndex;
  }

  function handleFanStateChange(isOpen: boolean) {
    dialHasFanOpen = isOpen;
    if (!isOpen) openFanFace = null;
  }
</script>

<svelte:window
  onkeydown={handleKeyDown}
  onkeyup={handleKeyUp}
  onfocusin={(e) => {
    if (shouldAutoEnterInputMode(e.target)) inputMode = true;
  }}
/>

<div class="relative w-screen h-screen overflow-hidden" style="background: var(--canvas-bg);">
  <canvas bind:this={canvas} class="block w-full h-full"></canvas>

  {#if controlsVisible}
    <FileBrowserHex
      files={storeFiles}
      activeFileId={storeActiveFileId}
    />

    {#if layersPanelVisible}
      <LayersPanel
        layers={activeLayers}
        onToggleVisibility={handleToggleVisibility}
        onUpdateText={handleUpdateText}
        onUpdateEntities={handleUpdateEntities}
        onAddLayer={handleAddLayer}
        onRemoveLayer={handleRemoveLayer}
        onGenerate={handleGenerate}
        {generateLoading}
      />
    {/if}

    <!-- Movement dial: bottom-left -->
    <MovementDial
      {compassAngle}
      {cameraMode}
      {shiftHeld}
      onInputStart={handleInputStart}
      onInputEnd={handleInputEnd}
      onLookAtOrigin={handleLookAtOrigin}
      {keyActiveActions}
    />

    <!-- Hexagon dial: bottom-right -->
    <HexagonDial
      bays={dialBays}
      {activeBayIndex}
      selections={dialSelections}
      onSelect={handleDialSelect}
      onToggle={handleDialToggle}
      onBayChange={handleBayChange}
      onFanStateChange={handleFanStateChange}
      activateFace={dialActivateFace}
      activateCenter={dialActivateCenter}
      activateOptionIndex={dialActivateOption}
      dismiss={dialDismiss}
    />

    <!-- Chat input: centered above status bar -->
    <ChatInput
      onSubmit={handleChatSubmit}
      loading={isProcessing}
    />

    <!-- Pipeline error banner -->
    {#if pipelineError}
      <div class="pipeline-error-banner">
        <span>{pipelineError}</span>
        <button onclick={() => { pipelineError = null; }} aria-label="Dismiss error">&times;</button>
      </div>
    {/if}
  {/if}

  <!-- Help button: top-right hexagonal "?" -->
  <button
    class="help-hex"
    onclick={() => { if (helpVisible) closeModal(); else openHelp(); }}
    aria-label="Toggle keyboard shortcuts help"
    title="Keyboard shortcuts (?)"
  >
    <svg viewBox="0 0 34 30" width="34" height="30" class="block">
      <polygon
        points="31,15 24,27 10,27 3,15 10,3 24,3"
        stroke-width="1"
        stroke-linejoin="round"
        style="fill: var(--glass-bg); stroke: var(--glass-border);"
      />
      <text
        x="17" y="16.5"
        text-anchor="middle"
        dominant-baseline="central"
        fill="var(--text-secondary)"
        font-size="14"
        font-family="var(--font-main)"
        font-weight="600"
      >?</text>
    </svg>
  </button>

  {#if helpVisible}
    <KeyboardHelp
      bays={dialBays}
      {activeBayIndex}
      onClose={closeModal}
      onRunSetup={() => { closeModal(); setTimeout(() => { showOnboarding = true; }, 100); }}
    />
  {/if}

  {#if settingsVisible}
    <SettingsModal onClose={closeModal} />
  {/if}

  {#if showOnboarding}
    <OnboardingModal
      onClose={() => { showOnboarding = false; }}
      onComplete={async (choice) => {
        showOnboarding = false;
        if (choice === 'default') {
          const file = await files3dStore.create('Terran System');
          await files3dStore.updateLayers(file.id, structuredClone(solarLayers));
        } else {
          await files3dStore.create('Untitled Scene');
        }
      }}
    />
  {/if}

  {#if fileListVisible}
    <FileListModal
      files={storeFiles}
      activeFileId={storeActiveFileId}
      onSelectFile={handleSelectFile}
      onCreateFile={handleCreateFile}
      onDeleteFile={handleDeleteFile}
      onClose={() => { fileListVisible = false; }}
    />
  {/if}

  {#if controlsVisible}
    <!-- Input mode toggle: above help hex -->
    <button
      class="input-mode-hex"
      onclick={() => { inputMode = !inputMode; }}
      aria-label={inputMode ? 'Switch to command mode' : 'Switch to input mode'}
      title={inputMode ? 'Input mode (Esc to exit)' : 'Command mode (I)'}
    >
      <svg viewBox="0 0 34 30" width="34" height="30" class="block">
        <polygon
          points="31,15 24,27 10,27 3,15 10,3 24,3"
          stroke-width="1"
          stroke-linejoin="round"
          style="fill: {inputMode ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg)'}; stroke: {inputMode ? '#3b82f6' : 'var(--glass-border)'};"
        />
        <text
          x="17" y="16.5"
          text-anchor="middle"
          dominant-baseline="central"
          fill={inputMode ? '#3b82f6' : 'var(--text-secondary)'}
          font-size="14"
          font-family="var(--font-main)"
          font-weight="600"
        >{inputMode ? 'I' : 'C'}</text>
      </svg>
    </button>
  {/if}

  <StatusBar
    mode={inputMode ? 'input' : 'command'}
    {cameraMode}
    voiceRecording={false}
    {activeFileName}
    fps={currentFps}
    config={statusBarConfig}
    {pipelineStage}
    onAbort={() => bridge?.abort()}
    observationMode={activeMode}
  />
</div>

<style>
  .help-hex {
    position: absolute;
    top: 16px;
    right: 302px; /* 280px panel + 16px gap + 6px for hex */
    z-index: 20;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
    padding: 0;
  }

  .help-hex:hover {
    opacity: 1;
  }

  .input-mode-hex {
    position: absolute;
    top: 16px;
    right: 342px; /* help-hex right (302px) + hex width (34px) + 6px gap */
    z-index: 20;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
    padding: 0;
  }

  .input-mode-hex:hover {
    opacity: 1;
  }

  .pipeline-error-banner {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 35;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    font-size: 13px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 480px;
  }

  .pipeline-error-banner button {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0 2px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .pipeline-error-banner button:hover {
    opacity: 1;
  }
</style>
