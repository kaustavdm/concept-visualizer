<script lang="ts">
  import type { HexBayConfig } from './hexagon-dial.types';
  import GlassModal from './GlassModal.svelte';

  interface Props {
    bays: HexBayConfig[];
    activeBayIndex: number;
    onClose: () => void;
    onRunSetup?: () => void;
  }

  let { bays, activeBayIndex, onClose, onRunSetup }: Props = $props();

  let activeBay = $derived(bays[activeBayIndex]);

  const POSITION_KEYS = ['O', ';', '.', ',', 'M', 'K'];

  // Build hex dial shortcuts from active bay
  let hexShortcuts = $derived(
    POSITION_KEYS.map((key, i) => ({
      key,
      label: activeBay.faces[i].label,
    }))
  );
</script>

<GlassModal title="Keyboard Shortcuts" {onClose} maxWidth="540px">
  <!-- Global -->
  <section class="shortcut-group">
    <h3 class="group-title">Global</h3>
    <div class="shortcut-grid">
      <div class="shortcut-row">
        <kbd>?</kbd>
        <span>Toggle this help</span>
      </div>
      <div class="shortcut-row">
        <kbd>F</kbd>
        <span>Toggle fullscreen</span>
      </div>
      <div class="shortcut-row">
        <kbd>H</kbd>
        <span>Toggle controls</span>
      </div>
      <div class="shortcut-row">
        <kbd>I</kbd>
        <span>Enter input mode</span>
      </div>
      <div class="shortcut-row">
        <kbd>Esc</kbd>
        <span>Close / exit input mode</span>
      </div>
    </div>
  </section>

  <!-- Camera Movement -->
  <section class="shortcut-group">
    <h3 class="group-title">Camera Movement</h3>
    <div class="shortcut-grid">
      <div class="shortcut-row">
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>
        <span>Pan up / left / down / right</span>
      </div>
      <div class="shortcut-row">
        <kbd>Z</kbd> <kbd>X</kbd>
        <span>Zoom in / out</span>
      </div>
      <div class="shortcut-row">
        <kbd>C</kbd>
        <span>Look at origin</span>
      </div>
      <div class="shortcut-row">
        <kbd>Shift</kbd>
        <span>Hold to toggle orbit / fly</span>
      </div>
      <div class="shortcut-row">
        <kbd>M</kbd> then <kbd>F</kbd>
        <span>Enter follow mode</span>
      </div>
      <div class="shortcut-row">
        <kbd>Space</kbd>
        <span>Cycle follow target</span>
      </div>
    </div>
  </section>

  <!-- Hex Dial -->
  <section class="shortcut-group">
    <h3 class="group-title">
      Hex Dial
      <span class="bay-badge" style="color: {activeBay.tint.accent};">
        {activeBay.label}
      </span>
    </h3>
    <div class="shortcut-grid">
      {#each hexShortcuts as { key, label }}
        <div class="shortcut-row">
          <kbd>{key}</kbd>
          <span>{label}</span>
        </div>
      {/each}
      <div class="shortcut-row">
        <kbd>L</kbd>
        <span>Switch bay</span>
      </div>
      <div class="shortcut-row">
        <kbd>1</kbd>–<kbd>9</kbd>
        <span>Select fan-out option</span>
      </div>
    </div>
  </section>

  <!-- Mouse -->
  <section class="shortcut-group last">
    <h3 class="group-title">Mouse</h3>
    <div class="shortcut-grid">
      <div class="shortcut-row">
        <kbd class="wide">Left drag</kbd>
        <span>Orbit / pan camera</span>
      </div>
      <div class="shortcut-row">
        <kbd class="wide">Scroll</kbd>
        <span>Zoom in / out</span>
      </div>
      <div class="shortcut-row">
        <kbd class="wide">Right drag</kbd>
        <span>Pan camera</span>
      </div>
    </div>
  </section>

  {#snippet footer()}
    {#if onRunSetup}
      <button class="setup-link" onclick={onRunSetup}>
        Run Setup Wizard
      </button>
    {/if}
  {/snippet}
</GlassModal>

<style>
  .shortcut-group {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--glass-border);
  }

  .shortcut-group.last {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .group-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bay-badge {
    font-size: 10px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.9;
  }

  .shortcut-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .shortcut-row span {
    margin-left: auto;
    text-align: right;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 22px;
    padding: 0 6px;
    border-radius: 4px;
    font-family: var(--font-main);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  kbd.wide {
    min-width: auto;
    padding: 0 8px;
  }

  .setup-link {
    display: inline-block;
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-main);
    transition: opacity 0.15s;
  }

  .setup-link:hover {
    opacity: 0.8;
  }
</style>
