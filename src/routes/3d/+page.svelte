<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { createScene, type SceneController, type CameraMode } from '$lib/3d/createScene';
  import MovementDial from '$lib/components/3d/MovementDial.svelte';
  import SceneDial from '$lib/components/3d/SceneDial.svelte';

  let canvas: HTMLCanvasElement;
  let scene: SceneController | null = $state(null);
  let cameraMode: CameraMode = $state('orbit');
  let theme: 'light' | 'dark' = $state('light');
  let shiftHeld = $state(false);
  let controlsVisible = $state(true);
  let compassAngle = $state(0);
  let dialActivateFace: string | null = $state(null);
  let dialActivateCenter = $state(false);
  let keyActiveActions = $state(new Set<string>());
  let dialSelections = $state<Record<string, string>>({
    theme: 'light',
    lighting: 'studio',
    environment: 'void',
    objects: 'all',
    camera: 'orbit',
    effects: 'none',
  });

  onMount(() => {
    const s = createScene(canvas, theme);
    scene = s;

    // Subscribe to settings store inside onMount (NOT $effect) to avoid
    // infinite loop: the callback reads+writes dialSelections, and $effect
    // would track that read as a dependency, causing re-execution on every write.
    const unsub = settingsStore.subscribe((settings) => {
      theme = settings.theme;
      s.setTheme(settings.theme);
      document.documentElement.setAttribute('data-theme', settings.theme);
      dialSelections = { ...dialSelections, theme: settings.theme };
    });

    // Poll compass angle using captured `s` reference (not the reactive signal)
    // to avoid stale closure issues with $state inside rAF callbacks
    let raf: number;
    function tick() {
      compassAngle = s.getCompassAngle();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      unsub();
      cancelAnimationFrame(raf);
      s.destroy();
      scene = null;
    };
  });

  // Keyboard: continuous hold for WASD/ZX, F for fullscreen, H for hide controls
  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;

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

    // SceneDial face shortcuts
    const dialMap: Record<string, string> = {
      o: 'theme',
      ';': 'lighting',
      '.': 'environment',
      ',': 'objects',
      m: 'camera',
      k: 'effects',
    };
    const face = dialMap[e.key.toLowerCase()];
    if (face) {
      dialActivateFace = face;
      // Reset after a tick so the effect fires again for repeated presses
      requestAnimationFrame(() => { dialActivateFace = null; });
      return;
    }
    if (e.key.toLowerCase() === 'l') {
      dialActivateCenter = true;
      requestAnimationFrame(() => { dialActivateCenter = false; });
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

  // Pad: continuous hold via pointer events
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
    const next = theme === 'light' ? 'dark' : 'light';
    settingsStore.update({ theme: next });
  }

  function handleDialSelect(faceId: string, optionId: string) {
    dialSelections = { ...dialSelections, [faceId]: optionId };
    if (faceId === 'camera') {
      scene?.setCameraMode(optionId as CameraMode);
      cameraMode = optionId as CameraMode;
    }
  }

  function handleDialToggle(faceId: string) {
    if (faceId === 'theme') {
      toggleTheme();
    }
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

    <!-- Scene dial: bottom-right -->
    <SceneDial
      selections={dialSelections}
      onSelect={handleDialSelect}
      onToggle={handleDialToggle}
      activateFace={dialActivateFace}
      activateCenter={dialActivateCenter}
    />
  {/if}
</div>
