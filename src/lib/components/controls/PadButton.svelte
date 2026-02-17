<script lang="ts">
  import { icons, keyLabels } from './icons';
  import type { PadAction } from '$lib/controllers/keyboard';

  interface Props {
    action: PadAction;
    active?: boolean;
    disabled?: boolean;
    onclick: () => void;
    showKeyHint?: boolean;
    size?: number;
  }

  let {
    action,
    active = false,
    disabled = false,
    onclick,
    showKeyHint = false,
    size = 40
  }: Props = $props();

  const iconPath = $derived(icons[action] ?? '');
  const keyLabel = $derived(keyLabels[action] ?? '');
</script>

<button
  class="relative rounded-full flex items-center justify-center transition-all duration-100 outline-none
    {disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
    {active ? 'scale-95' : ''}"
  style="
    width: {size}px;
    height: {size}px;
    background: {active ? 'var(--pad-btn-bg-active)' : 'var(--pad-btn-bg)'};
  "
  style:box-shadow={active ? '0 0 12px var(--accent)' : 'none'}
  {disabled}
  onclick={() => { if (!disabled) onclick(); }}
  title="{action} ({keyLabel})"
>
  <svg
    width={size * 0.5}
    height={size * 0.5}
    viewBox="0 0 24 24"
    fill={active ? 'var(--accent)' : 'var(--text-tertiary)'}
  >
    <path d={iconPath} />
  </svg>

  {#if showKeyHint && keyLabel}
    <span
      class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-medium opacity-60"
      style="color: {active ? 'var(--accent)' : 'var(--text-tertiary)'}"
    >
      {keyLabel}
    </span>
  {/if}
</button>
