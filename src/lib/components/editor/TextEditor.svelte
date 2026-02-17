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
  }

  let { text, onchange, onvisualize, loading, autoSend, onAutoSendToggle, file }: Props = $props();

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
