<script lang="ts">
  import PadButton from './PadButton.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    showKeyHints: boolean;
  }

  let { activeActions, onAction, showKeyHints }: Props = $props();
</script>

<div class="flex gap-3 items-center">
  <PadButton action="zoom_in" active={activeActions.has('zoom_in')} onclick={() => onAction('zoom_in')} showKeyHint={showKeyHints} />
  <PadButton action="zoom_out" active={activeActions.has('zoom_out')} onclick={() => onAction('zoom_out')} showKeyHint={showKeyHints} />
</div>
