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

<div class="relative w-[130px] h-[130px]">
  <!-- W - top -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2">
    <PadButton action="focus_up" active={activeActions.has('focus_up')} onclick={() => onAction('focus_up')} showKeyHint={showKeyHints} />
  </div>
  <!-- A - left -->
  <div class="absolute top-1/2 left-0 -translate-y-1/2">
    <PadButton action="focus_left" active={activeActions.has('focus_left')} onclick={() => onAction('focus_left')} showKeyHint={showKeyHints} />
  </div>
  <!-- Space - center -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
    <PadButton action="fit_to_screen" active={activeActions.has('fit_to_screen')} onclick={() => onAction('fit_to_screen')} showKeyHint={showKeyHints} size={36} />
  </div>
  <!-- D - right -->
  <div class="absolute top-1/2 right-0 -translate-y-1/2">
    <PadButton action="focus_right" active={activeActions.has('focus_right')} onclick={() => onAction('focus_right')} showKeyHint={showKeyHints} />
  </div>
  <!-- S - bottom -->
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2">
    <PadButton action="focus_down" active={activeActions.has('focus_down')} onclick={() => onAction('focus_down')} showKeyHint={showKeyHints} />
  </div>
</div>
