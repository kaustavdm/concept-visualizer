<script lang="ts">
  export type PlacementMode = 'hud' | 'dock' | 'embedded';

  interface Props {
    current: PlacementMode;
    onChange: (mode: PlacementMode) => void;
  }

  let { current, onChange }: Props = $props();
  let open = $state(false);

  const modes: { value: PlacementMode; label: string }[] = [
    { value: 'hud', label: 'Floating' },
    { value: 'dock', label: 'Dock' },
    { value: 'embedded', label: 'Embedded' }
  ];
</script>

<div class="relative">
  <button
    class="w-6 h-6 rounded flex items-center justify-center transition-colors"
    style="background: var(--pad-btn-bg)"
    onclick={() => open = !open}
    title="Change control placement"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#6b7280">
      <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
    </svg>
  </button>

  {#if open}
    <div class="absolute bottom-full mb-1 right-0 rounded-lg py-1 min-w-[100px] shadow-lg"
      style="background: var(--glass-bg); backdrop-filter: blur(16px); border: 1px solid var(--glass-border)">
      {#each modes as mode}
        <button
          class="w-full text-left px-3 py-1 text-xs transition-colors
            {current === mode.value ? 'font-medium' : ''}"
          style="color: {current === mode.value ? 'var(--accent)' : '#6b7280'}"
          onclick={() => { onChange(mode.value); open = false; }}
        >
          {mode.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
