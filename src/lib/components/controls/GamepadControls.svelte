<script lang="ts">
  import NavCluster from './NavCluster.svelte';
  import ZoomPair from './ZoomPair.svelte';
  import ActionCluster from './ActionCluster.svelte';
  import PlacementToggle, { type PlacementMode } from './PlacementToggle.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';
  import type { VisualizationType } from '$lib/types';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    vizType: VisualizationType | null;
    autoSendOn: boolean;
    placement: PlacementMode;
    onPlacementChange: (mode: PlacementMode) => void;
  }

  let { activeActions, onAction, vizType, autoSendOn, placement, onPlacementChange }: Props = $props();
  let showKeyHints = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = $state(true);

  // For HUD mode: fade in on activity, fade out after idle
  function resetIdle() {
    idle = false;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idle = true; }, 3000);
  }

  $effect(() => {
    if (activeActions.size > 0) resetIdle();
  });
</script>

<svelte:window onmousemove={() => { if (placement === 'hud') resetIdle(); }} />

{#if placement === 'hud'}
  <!-- Floating HUD: left and right clusters in bottom corners of canvas -->
  <div
    class="absolute bottom-6 left-6 z-20 flex flex-col gap-4 items-center transition-opacity duration-300 rounded-2xl p-3"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      opacity: {idle ? 0.4 : 1};
    "
    onmouseenter={() => { showKeyHints = true; resetIdle(); }}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    tabindex="0"
    aria-label="Navigation controls"
  >
    <NavCluster {activeActions} {onAction} {showKeyHints} />
    <ZoomPair {activeActions} {onAction} {showKeyHints} />
  </div>

  <div
    class="absolute bottom-6 right-6 z-20 flex flex-col gap-2 items-end transition-opacity duration-300 rounded-2xl p-3"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      opacity: {idle ? 0.4 : 1};
    "
    onmouseenter={() => { showKeyHints = true; resetIdle(); }}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    tabindex="0"
    aria-label="Action controls"
  >
    <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
    <PlacementToggle current={placement} onChange={onPlacementChange} />
  </div>

{:else if placement === 'dock'}
  <!-- Bottom dock: horizontal bar below canvas -->
  <div
    class="w-full flex items-center justify-between px-6 py-2 rounded-none"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--glass-border);
      height: 56px;
    "
    onmouseenter={() => showKeyHints = true}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    tabindex="0"
    aria-label="Controls dock"
  >
    <div class="flex items-center gap-6">
      <NavCluster {activeActions} {onAction} {showKeyHints} />
      <ZoomPair {activeActions} {onAction} {showKeyHints} />
    </div>
    <div class="flex items-center gap-4">
      <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
      <PlacementToggle current={placement} onChange={onPlacementChange} />
    </div>
  </div>

{:else if placement === 'embedded'}
  <!-- Embedded in editor pane -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-gray-200"
    onmouseenter={() => showKeyHints = true}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    tabindex="0"
    aria-label="Controls"
  >
    <div class="flex items-center gap-4">
      <NavCluster {activeActions} {onAction} {showKeyHints} />
      <ZoomPair {activeActions} {onAction} {showKeyHints} />
    </div>
    <div class="flex items-center gap-3">
      <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
      <PlacementToggle current={placement} onChange={onPlacementChange} />
    </div>
  </div>
{/if}
