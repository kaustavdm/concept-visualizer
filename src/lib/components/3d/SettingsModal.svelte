<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import GlassModal from './GlassModal.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let endpoint = $state('');
  let model = $state('');
  let theme = $state<'light' | 'dark'>('light');

  let pageOrigin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
  let isMixedContent = $derived(
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    endpoint.startsWith('http://')
  );

  onMount(() => {
    const unsub = settingsStore.subscribe((s) => {
      endpoint = s.llmEndpoint;
      model = s.llmModel;
      theme = s.theme;
    });
    settingsStore.init();
    return unsub;
  });

  async function save() {
    await settingsStore.update({ llmEndpoint: endpoint, llmModel: model, theme });
    onClose();
  }
</script>

<GlassModal title="Settings" {onClose}>
  <form onsubmit={(e) => { e.preventDefault(); save(); }} class="settings-form">
    <div class="field">
      <label for="settings-endpoint" class="field-label">LLM Endpoint</label>
      <input
        id="settings-endpoint"
        type="url"
        bind:value={endpoint}
        class="field-input"
        placeholder="http://localhost:11434/v1"
      />
      {#if isMixedContent}
        <div class="mixed-content-warning">
          <strong>Mixed-content warning:</strong> This HTTP endpoint will be blocked by the browser when the app is served over HTTPS. To fix:
          <ul>
            <li>Use <strong>Chrome</strong> and set <code>OLLAMA_ORIGINS={pageOrigin}</code></li>
            <li>Run the app <strong>locally</strong> via <code>npm run preview</code></li>
            <li>Put Ollama behind an <strong>HTTPS proxy</strong> and use an <code>https://</code> endpoint</li>
          </ul>
        </div>
      {:else}
        <p class="field-hint">OpenAI-compatible API endpoint</p>
      {/if}
    </div>

    <div class="field">
      <label for="settings-model" class="field-label">Model</label>
      <input
        id="settings-model"
        type="text"
        bind:value={model}
        class="field-input"
        placeholder="llama3.2"
      />
    </div>

    <div class="field">
      <label for="settings-theme" class="field-label">Theme</label>
      <select
        id="settings-theme"
        bind:value={theme}
        class="field-input"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div class="actions">
      <button type="submit" class="btn-save">Save</button>
      <button type="button" class="btn-cancel" onclick={onClose}>Cancel</button>
    </div>
  </form>
</GlassModal>

<style>
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .field-input {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    background: var(--pad-btn-bg);
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .field-input:focus {
    border-color: var(--accent);
  }

  .field-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
  }

  .mixed-content-warning {
    font-size: 11px;
    margin-top: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    background: color-mix(in srgb, orange 15%, var(--glass-bg));
    border: 1px solid color-mix(in srgb, orange 40%, transparent);
    color: var(--text-primary);
  }

  .mixed-content-warning ul {
    margin: 4px 0 0 16px;
    padding: 0;
    list-style: disc;
  }

  .mixed-content-warning li {
    margin-bottom: 2px;
  }

  .actions {
    display: flex;
    gap: 8px;
    padding-top: 4px;
  }

  .btn-save {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-main);
    border-radius: 6px;
    border: none;
    background: var(--accent);
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-save:hover {
    opacity: 0.9;
  }

  .btn-cancel {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-main);
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: none;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-cancel:hover {
    background: var(--pad-btn-bg-hover);
  }
</style>
