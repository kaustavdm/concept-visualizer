<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { createScene, type SceneController, type CameraMode } from '$lib/3d/createScene';
  import { files3dStore } from '$lib/stores/files3d';
  import { composeLayers } from '$lib/3d/compositor';
  import { solarLayers } from '$lib/3d/scenes/solar';
  import MovementDial from '$lib/components/3d/MovementDial.svelte';
  import HexagonDial from '$lib/components/3d/HexagonDial.svelte';
  import KeyboardHelp from '$lib/components/3d/KeyboardHelp.svelte';
  import LayersPanel from '$lib/components/3d/LayersPanel.svelte';
  import FileBrowserHex from '$lib/components/3d/FileBrowserHex.svelte';
  import FileListModal from '$lib/components/3d/FileListModal.svelte';
  import StatusBar from '$lib/components/3d/StatusBar.svelte';
  import { routeKeyDown, shouldProcessKeyUp, shouldAutoEnterInputMode } from '$lib/3d/input-mode';
  import { SCENE_BAY, APP_BAY, DEFAULT_SELECTIONS } from '$lib/components/3d/hexagon-dial-bays';
  import type { Layer3d, SerializableEntitySpec, File3d } from '$lib/3d/types';
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
  let helpVisible = $state(false);
  let fileListVisible = $state(false);
  let layersPanelVisible = $state(true);
  let storeFiles: File3d[] = $state([]);
  let storeActiveFileId: string | null = $state(null);
  let activeLayers: Layer3d[] = $state([]);
  let inputMode = $state(false);
  let activeFileName = $derived(
    storeFiles.find(f => f.id === storeActiveFileId)?.title ?? null
  );

  function resolveSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(resolved: 'light' | 'dark') {
    theme = resolved;
    scene?.setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    settingsStore.update({ theme: resolved });
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
    // Resolve initial theme: default to system detection
    const initialTheme = resolveSystemTheme();
    applyTheme(initialTheme);

    const s = createScene(canvas, initialTheme);
    scene = s;

    // Initialize 3D file store
    files3dStore.init().then(async () => {
      const state = get(files3dStore);
      if (state.files.length === 0) {
        const file = await files3dStore.create('Terran System');
        await files3dStore.updateLayers(file.id, structuredClone(solarLayers));
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
        s.setTheme(settings.theme);
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
    });

    let raf: number;
    function tick() {
      compassAngle = s.getCompassAngle();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      mql.removeEventListener('change', onSystemChange);
      unsub();
      unsub3d();
      cancelAnimationFrame(raf);
      s.destroy();
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
      const content = composeLayers(activeFile.layers, activeFile.id);
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
      l.id === layerId ? { ...l, text, updatedAt: new Date() } : l
    );
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  function handleUpdateEntities(layerId: string, entities: SerializableEntitySpec[]) {
    const plain = plainLayers();
    const updated = plain.map(l =>
      l.id === layerId ? { ...l, entities, updatedAt: new Date() } : l
    );
    if (storeActiveFileId) files3dStore.updateLayers(storeActiveFileId, updated);
  }

  function handleAddLayer() {
    const plain = plainLayers();
    const now = new Date();
    const newLayer: Layer3d = {
      id: uuid(),
      name: `Layer ${plain.length + 1}`,
      visible: true,
      text: '',
      entities: [],
      order: plain.length,
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
    const route = routeKeyDown(e.key, { inputMode, helpVisible, fileListVisible });
    switch (route.action) {
      case 'close_help': helpVisible = false; return;
      case 'close_file_list': fileListVisible = false; return;
      case 'exit_input_mode': inputMode = false; return;
      case 'enter_input_mode': inputMode = true; return;
      case 'blocked': return;
      // 'passthrough' → continue to command mode handlers below
    }

    // --- Command mode only below ---

    // '?' toggles help overlay (Shift+/ on US layout)
    if (e.key === '?') {
      helpVisible = !helpVisible;
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
      dialActivateFace = face;
      openFanFace = face;
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
    if (!shouldProcessKeyUp({ inputMode, helpVisible, fileListVisible })) return;

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

    // Scenes face: actions (not a persistent selection)
    if (faceId === 'scenes') {
      if (optionId === 'new') handleCreateFile();
      else if (optionId === 'clone') handleCloneFile();
      else if (optionId === 'list') { fileListVisible = true; }
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
  {/if}

  <!-- Help button: top-right hexagonal "?" -->
  <button
    class="help-hex"
    onclick={() => { helpVisible = !helpVisible; }}
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
      onClose={() => { helpVisible = false; }}
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
</style>
