<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { resetDatabase } from '$lib/db';
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

  let resetStep = $state(0);
  let countdown = $state(5);

  async function performReset(): Promise<void> {
    await resetDatabase();
    countdown = 5;
    resetStep = 3;
  }

  function reloadApp(): void {
    window.location.href = '/';
  }

  $effect(() => {
    if (resetStep !== 3) return;
    const id = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(id);
        reloadApp();
      }
    }, 1000);
    return () => clearInterval(id);
  });
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

    <div class="danger-zone">
      <p class="danger-label">Danger Zone</p>
      <div class="danger-card">
        <div class="danger-info">
          <p class="danger-title">Reset App Data</p>
          <p class="danger-desc">Delete all scenes, settings, and cached data. This cannot be undone.</p>
        </div>
        <button type="button" class="btn-danger" onclick={() => resetStep = 1}>Reset</button>
      </div>
    </div>
  </form>
</GlassModal>

{#if resetStep === 1}
  <GlassModal title="Reset App Data" onClose={() => resetStep = 0} maxWidth="400px">
    <div class="confirm-content">
      <div class="confirm-icon">&#9888;</div>
      <p class="confirm-text">
        This will <strong>permanently delete</strong> all your scenes, settings,
        and cached data. This action cannot be undone.
      </p>
    </div>
    {#snippet footer()}
      <div class="confirm-actions">
        <button class="btn-cancel" onclick={() => resetStep = 0}>Cancel</button>
        <button class="btn-danger-solid" onclick={() => resetStep = 2}>Delete Everything</button>
      </div>
    {/snippet}
  </GlassModal>
{/if}

{#if resetStep === 2}
  <GlassModal title="Are you sure?" onClose={() => resetStep = 0} maxWidth="400px">
    <div class="confirm-content">
      <div class="confirm-icon confirm-icon-final">&#9888;</div>
      <p class="confirm-text">
        <strong>Last chance.</strong> All scenes and settings will be lost forever.
        The app will reload as if opened for the first time.
      </p>
    </div>
    {#snippet footer()}
      <div class="confirm-actions">
        <button class="btn-cancel" onclick={() => resetStep = 0}>Cancel</button>
        <button class="btn-danger-solid" onclick={performReset}>Reset Now</button>
      </div>
    {/snippet}
  </GlassModal>
{/if}

{#if resetStep === 3}
  <GlassModal title="Reset Complete" onClose={reloadApp} maxWidth="400px">
    <div class="confirm-content">
      <div class="confirm-icon confirm-icon-success">&#10003;</div>
      <p class="confirm-text">
        All app data has been cleared. The app will reload momentarily.
      </p>
    </div>
    {#snippet footer()}
      <div class="confirm-actions">
        <button class="btn-save" onclick={reloadApp}>
          Reload Now ({countdown}s)
        </button>
      </div>
    {/snippet}
  </GlassModal>
{/if}

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

  /* Danger zone */
  .danger-zone {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    margin-top: 8px;
    border-top: 1px solid var(--glass-border);
  }

  .danger-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--danger);
    margin: 0;
  }

  .danger-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--glass-border));
    background: var(--danger-light);
  }

  .danger-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .danger-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
  }

  .danger-desc {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
  }

  .btn-danger {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-main);
    border-radius: 6px;
    border: 1px solid var(--danger);
    background: transparent;
    color: var(--danger);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .btn-danger:hover {
    background: var(--danger);
    color: white;
  }

  /* Confirmation modals */
  .confirm-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 8px 0;
  }

  .confirm-icon {
    font-size: 32px;
    line-height: 1;
    color: var(--danger-text);
  }

  .confirm-icon-final {
    color: var(--danger);
  }

  .confirm-icon-success {
    color: #34d399;
  }

  .confirm-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-danger-solid {
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-main);
    border-radius: 6px;
    border: none;
    background: var(--danger);
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-danger-solid:hover {
    opacity: 0.9;
  }
</style>
