<script lang="ts">
  import type { ConceptFile } from '$lib/types';

  interface Props {
    text: string;
    onchange: (text: string) => void;
    onvisualize: () => void;
    loading: boolean;
    autoSend: boolean;
    onAutoSendToggle: (enabled: boolean) => void;
    file: ConceptFile | undefined;
    isFromCache?: boolean;
    onReextract?: () => void;
  }

  let { text, onchange, onvisualize, loading, autoSend, onAutoSendToggle, file, isFromCache = false, onReextract }: Props = $props();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    onchange(value);

    if (autoSend) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onvisualize(), 2000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onvisualize();
    }
  }
</script>

<div class="flex-1 flex flex-col p-4 gap-3">
  <textarea
    class="flex-1 w-full resize-none rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
    style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
    placeholder="Describe a concept to visualize..."
    value={text}
    oninput={handleInput}
    onkeydown={handleKeydown}
    disabled={loading}
  ></textarea>

  <div class="flex items-center justify-between">
    <label class="flex items-center gap-2 text-xs cursor-pointer" style="color: var(--text-tertiary)">
      <input
        type="checkbox"
        checked={autoSend}
        onchange={(e) => onAutoSendToggle((e.target as HTMLInputElement).checked)}
        class="rounded"
        style="accent-color: var(--accent); border-color: var(--input-border)"
      />
      Auto-visualize
    </label>

    <div class="flex items-center gap-2">
      {#if isFromCache}
        <span class="text-xs px-2 py-0.5 rounded-full" style="background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent)">
          cached
        </span>
        {#if onReextract}
          <button
            onclick={onReextract}
            disabled={loading}
            title="Re-extract from LLM"
            class="p-1 rounded opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
            style="color: var(--text-tertiary)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        {/if}
      {/if}
      <button
        onclick={onvisualize}
        disabled={loading || !text.trim()}
        class="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style="background: var(--accent)"
      >
        {loading ? 'Generating...' : 'Visualize'}
        {#if !loading}
          <kbd class="ml-1.5 text-[10px] opacity-70">Cmd+Enter</kbd>
        {/if}
      </button>
    </div>
  </div>
</div>
