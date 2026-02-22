<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import GlassModal from './GlassModal.svelte';

  interface Props {
    onClose: () => void;
    onComplete: (scene: 'default' | 'empty') => void;
  }

  let { onClose, onComplete }: Props = $props();

  let endpoint = $state('');
  let model = $state('');

  onMount(() => {
    settingsStore.init();
    const unsub = settingsStore.subscribe((s) => {
      endpoint = s.llmEndpoint;
      model = s.llmModel;
    });
    return unsub;
  });

  async function handleStart(scene: 'default' | 'empty'): Promise<void> {
    await settingsStore.update({
      llmEndpoint: endpoint,
      llmModel: model,
      onboardingCompleted: true,
    });
    onComplete(scene);
  }
</script>

<GlassModal title="Welcome" {onClose} maxWidth="520px">
  <div class="onboarding">
    <p class="welcome-text">
      <strong>Concept Visualizer</strong> turns text into interactive 3D scenes.
      Type a concept in the chat input and watch it come to life. Configure your
      LLM endpoint below to get started.
    </p>

    <form onsubmit={(e) => { e.preventDefault(); handleStart('default'); }} class="onboarding-form">
      <div class="field">
        <label for="onboard-endpoint" class="field-label">LLM Endpoint</label>
        <input
          id="onboard-endpoint"
          type="url"
          bind:value={endpoint}
          class="field-input"
          placeholder="http://localhost:11434/v1"
        />
        <p class="field-hint">OpenAI-compatible API endpoint (e.g. Ollama, vLLM)</p>
      </div>

      <div class="field">
        <label for="onboard-model" class="field-label">Model</label>
        <input
          id="onboard-model"
          type="text"
          bind:value={model}
          class="field-input"
          placeholder="llama3.2"
        />
      </div>

      <div class="scene-choice">
        <p class="field-label">Start with</p>
        <div class="scene-buttons">
          <button type="submit" class="btn-start">Terran System</button>
          <button type="button" class="btn-start btn-secondary" onclick={() => handleStart('empty')}>Empty Scene</button>
        </div>
      </div>
    </form>
  </div>
</GlassModal>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .welcome-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  .onboarding-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
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

  .scene-choice {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .scene-buttons {
    display: flex;
    gap: 8px;
  }

  .btn-start {
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-main);
    border-radius: 6px;
    border: none;
    background: var(--accent);
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-start:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--glass-border);
  }

  .btn-secondary:hover {
    background: var(--pad-btn-bg);
    opacity: 1;
  }
</style>
