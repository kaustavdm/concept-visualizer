<script lang="ts">
  import PadButton from './PadButton.svelte';
  import { icons } from './icons';
  import type { PadAction } from '$lib/controllers/keyboard';
  import type { VisualizationType } from '$lib/types';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    showKeyHints: boolean;
    vizType: VisualizationType | null;
    autoSendOn: boolean;
  }

  let { activeActions, onAction, showKeyHints, vizType, autoSendOn }: Props = $props();

  const vizTypeIcon = $derived(vizType ? icons[`viz_${vizType}`] : icons['viz_graph']);
</script>

<div class="relative w-[130px] h-[130px]">
  <!-- Enter - top -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2">
    <PadButton action="visualize" active={activeActions.has('visualize')} onclick={() => onAction('visualize')} showKeyHint={showKeyHints} />
  </div>
  <!-- Tab - left -->
  <div class="absolute top-1/2 left-0 -translate-y-1/2">
    <PadButton action="cycle_viz_type" active={activeActions.has('cycle_viz_type')} onclick={() => onAction('cycle_viz_type')} showKeyHint={showKeyHints} />
  </div>
  <!-- Center indicator -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
    <div class="w-7 h-7 rounded-full flex items-center justify-center" style="background: var(--accent)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d={vizTypeIcon} />
      </svg>
    </div>
  </div>
  <!-- P - right -->
  <div class="absolute top-1/2 right-0 -translate-y-1/2">
    <PadButton action="export" active={activeActions.has('export')} onclick={() => onAction('export')} showKeyHint={showKeyHints} />
  </div>
  <!-- Q - bottom -->
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2">
    <PadButton action="toggle_auto_send" active={activeActions.has('toggle_auto_send')} onclick={() => onAction('toggle_auto_send')} showKeyHint={showKeyHints} />
  </div>
</div>
