<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { createScene, type SceneController, type CameraMode } from '$lib/3d/createScene';
  import { solarScene } from '$lib/3d/scenes/solar';
  import MovementDial from '$lib/components/3d/MovementDial.svelte';
  import HexagonDial from '$lib/components/3d/HexagonDial.svelte';
  import KeyboardHelp from '$lib/components/3d/KeyboardHelp.svelte';
  import { SCENE_BAY, APP_BAY, DEFAULT_SELECTIONS } from '$lib/components/3d/hexagon-dial-bays';

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
    s.loadContent(solarScene);
    scene = s;

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
      cancelAnimationFrame(raf);
      s.destroy();
      scene = null;
    };
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;

    // '?' toggles help overlay (Shift+/ on US layout)
    if (e.key === '?') {
      helpVisible = !helpVisible;
      return;
    }

    // When help is visible, only Escape closes it — block all other keys
    if (helpVisible) {
      if (e.key === 'Escape') {
        helpVisible = false;
      }
      return;
    }

    if (e.key === 'Escape') {
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
  }
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<div class="relative w-screen h-screen overflow-hidden" style="background: var(--canvas-bg);">
  <canvas bind:this={canvas} class="block w-full h-full"></canvas>

  {#if controlsVisible}
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

  {#if helpVisible}
    <KeyboardHelp
      bays={dialBays}
      {activeBayIndex}
      onClose={() => { helpVisible = false; }}
    />
  {/if}
</div>
