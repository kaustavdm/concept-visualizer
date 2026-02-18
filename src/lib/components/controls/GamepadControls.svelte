<script lang="ts">
  import NavCluster from './NavCluster.svelte';
  import ZoomPair from './ZoomPair.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';
  import type { PlacementMode } from './PlacementToggle.svelte';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    placement: PlacementMode;
  }

  let { activeActions, onAction, placement }: Props = $props();
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
  <!-- Floating HUD: nav+zoom cluster in bottom-left corner of canvas -->
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

{:else if placement === 'dock'}
  <!-- Bottom dock: horizontal bar below canvas -->
  <div
    class="w-full flex items-center justify-start px-6 py-2 rounded-none"
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
  </div>

{:else if placement === 'embedded'}
  <!-- Embedded in editor pane -->
  <div
    class="flex items-center px-4 py-3"
    style="border-bottom: 1px solid var(--border)"
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
  </div>
{/if}
