<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { goto } from '$app/navigation';

  let endpoint = $state('');
  let model = $state('');
  let theme = $state<'light' | 'dark'>('light');
  let controlPlacement = $state<'hud' | 'dock' | 'embedded'>('hud');
  let extractionEngine = $state<'llm' | 'nlp' | 'keywords' | 'semantic'>('llm');

  let pageOrigin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
  let isMixedContent = $derived(
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    endpoint.startsWith('http://')
  );

  onMount(async () => {
    await settingsStore.init();
    endpoint = $settingsStore.llmEndpoint;
    model = $settingsStore.llmModel;
    theme = $settingsStore.theme;
    controlPlacement = $settingsStore.controlPlacement;
    extractionEngine = $settingsStore.extractionEngine;
  });

  async function save() {
    await settingsStore.update({ llmEndpoint: endpoint, llmModel: model, theme, controlPlacement, extractionEngine });
    goto('/');
  }
</script>

<div class="max-w-lg mx-auto py-12 px-4 min-h-screen" style="background: var(--canvas-bg); color: var(--text-primary)">
  <h1 class="text-xl font-semibold mb-6">Settings</h1>

  <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-5">
    <div>
      <label for="endpoint" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">LLM Endpoint</label>
      <input
        id="endpoint"
        type="url"
        bind:value={endpoint}
        class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
        placeholder="http://localhost:11434/v1"
      />
      {#if isMixedContent}
        <div class="text-xs mt-1 rounded-md px-3 py-2" style="background: color-mix(in srgb, orange 15%, var(--canvas-bg)); border: 1px solid color-mix(in srgb, orange 40%, transparent); color: var(--text-primary)">
          <strong>Mixed-content warning:</strong> This HTTP endpoint will be blocked by the browser when the app is served over HTTPS. To fix:
          <ul class="mt-1 ml-3 list-disc space-y-0.5" style="color: var(--text-secondary)">
            <li>Use <strong>Chrome</strong> and set <code>OLLAMA_ORIGINS={pageOrigin}</code></li>
            <li>Run the app <strong>locally</strong> via <code>npm run preview</code></li>
            <li>Put Ollama behind an <strong>HTTPS proxy</strong> (e.g. Caddy) and use an <code>https://</code> endpoint</li>
          </ul>
        </div>
      {:else}
        <p class="text-xs mt-1" style="color: var(--text-muted)">OpenAI-compatible API endpoint</p>
      {/if}
    </div>

    <div>
      <label for="model" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">Model</label>
      <input
        id="model"
        type="text"
        bind:value={model}
        class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
        placeholder="llama3.2"
      />
    </div>

    <div>
      <label for="theme" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">Theme</label>
      <select
        id="theme"
        bind:value={theme}
        class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div>
      <label for="placement" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">Control Placement</label>
      <select
        id="placement"
        bind:value={controlPlacement}
        class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
      >
        <option value="hud">Floating HUD</option>
        <option value="dock">Bottom Dock</option>
        <option value="embedded">Embedded in Editor</option>
      </select>
    </div>

    <div>
      <label for="engine" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">Extraction Engine</label>
      <select
        id="engine"
        bind:value={extractionEngine}
        class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
      >
        <option value="llm">LLM (requires running server)</option>
        <option value="nlp">NLP (compromise.js)</option>
        <option value="keywords">Keywords (RAKE)</option>
        <option value="semantic">Semantic (TF.js - large download)</option>
      </select>
      <p class="text-xs mt-1" style="color: var(--text-muted)">NLP and Keywords work offline. Semantic requires ~30MB model download.</p>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
        style="background: var(--accent)"
      >
        Save
      </button>
      <a
        href="/"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style="border: 1px solid var(--border); color: var(--text-tertiary)"
      >
        Cancel
      </a>
    </div>
  </form>
</div>
