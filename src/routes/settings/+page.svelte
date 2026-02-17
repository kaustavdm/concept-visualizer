<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { goto } from '$app/navigation';

  let endpoint = $state('');
  let model = $state('');
  let theme = $state<'light' | 'dark'>('light');
  let controlPlacement = $state<'hud' | 'dock' | 'embedded'>('hud');
  let extractionEngine = $state<'llm' | 'nlp' | 'keywords' | 'semantic'>('llm');

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

<div class="max-w-lg mx-auto py-12 px-4">
  <h1 class="text-xl font-semibold mb-6">Settings</h1>

  <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-5">
    <div>
      <label for="endpoint" class="block text-sm font-medium text-gray-700 mb-1">LLM Endpoint</label>
      <input
        id="endpoint"
        type="url"
        bind:value={endpoint}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="--tw-ring-color: var(--accent)"
        placeholder="http://localhost:11434/v1"
      />
      <p class="text-xs text-gray-400 mt-1">OpenAI-compatible API endpoint</p>
    </div>

    <div>
      <label for="model" class="block text-sm font-medium text-gray-700 mb-1">Model</label>
      <input
        id="model"
        type="text"
        bind:value={model}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="--tw-ring-color: var(--accent)"
        placeholder="llama3.2"
      />
    </div>

    <div>
      <label for="theme" class="block text-sm font-medium text-gray-700 mb-1">Theme</label>
      <select
        id="theme"
        bind:value={theme}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="--tw-ring-color: var(--accent)"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div>
      <label for="placement" class="block text-sm font-medium text-gray-700 mb-1">Control Placement</label>
      <select
        id="placement"
        bind:value={controlPlacement}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="--tw-ring-color: var(--accent)"
      >
        <option value="hud">Floating HUD</option>
        <option value="dock">Bottom Dock</option>
        <option value="embedded">Embedded in Editor</option>
      </select>
    </div>

    <div>
      <label for="engine" class="block text-sm font-medium text-gray-700 mb-1">Extraction Engine</label>
      <select
        id="engine"
        bind:value={extractionEngine}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
        style="--tw-ring-color: var(--accent)"
      >
        <option value="llm">LLM (requires running server)</option>
        <option value="nlp">NLP (compromise.js)</option>
        <option value="keywords">Keywords (RAKE)</option>
        <option value="semantic">Semantic (TF.js - large download)</option>
      </select>
      <p class="text-xs text-gray-400 mt-1">NLP and Keywords work offline. Semantic requires ~30MB model download.</p>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
        style="background: var(--accent)"
      >
        Save
      </button>
      <a href="/" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
        Cancel
      </a>
    </div>
  </form>
</div>
