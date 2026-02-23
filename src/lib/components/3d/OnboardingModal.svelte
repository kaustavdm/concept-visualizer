<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { warmupTier2Model } from '$lib/pipeline/tiers/tier2-refine';
  import GlassModal from './GlassModal.svelte';

  interface Props {
    onClose: () => void;
    onComplete: (scene: 'default' | 'empty') => void;
  }

  let { onClose, onComplete }: Props = $props();

  let endpoint = $state('');
  let model = $state('');
  let step = $state(1);
  let downloadStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let downloadError = $state('');

  async function handlePreDownload(): Promise<void> {
    downloadStatus = 'loading';
    downloadError = '';
    try {
      await warmupTier2Model();
      downloadStatus = 'done';
    } catch (err) {
      downloadStatus = 'error';
      downloadError = err instanceof Error ? err.message : 'Download failed';
    }
  }

  const STEP_TITLES = ['Welcome', 'NLP Models', 'LLM Configuration', 'Get Started'];
  let title = $derived(STEP_TITLES[step - 1]);

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

<GlassModal {title} {onClose} maxWidth="520px">
  <div class="onboarding">
    {#if step === 1}
      <div class="step-content">
        <p class="step-body">
          <strong>Concept Visualizer</strong> turns text into interactive 3D concept maps.
          Type any idea, passage, or question into the chat — and watch it unfold as a
          living, spatial scene you can orbit, explore, and build on.
        </p>
        <p class="step-body">
          We'll walk you through a quick setup:
        </p>
        <ol class="step-list">
          <li>Learn about the NLP models that power in-browser extraction</li>
          <li>Configure your LLM endpoint for deeper analysis</li>
          <li>Choose a starter scene to explore</li>
        </ol>
      </div>

    {:else if step === 2}
      <div class="step-content">
        <p class="step-body">
          Concept Visualizer uses <strong>TensorFlow.js</strong> models that run entirely in
          your browser — no server needed for basic concept extraction.
        </p>
        <div class="info-card">
          <p class="info-title">Universal Sentence Encoder</p>
          <p class="info-detail">
            Powers tier-2 semantic embedding and concept clustering.
            Identifies relationships between concepts by measuring meaning similarity.
          </p>
          <p class="info-meta">~30 MB download on first use, cached afterwards</p>
        </div>
        <div class="download-section">
          {#if downloadStatus === 'idle'}
            <button class="btn-download" onclick={handlePreDownload}>
              Download models now
            </button>
            <p class="step-body step-note">
              Or skip — models will download automatically on first use.
            </p>
          {:else if downloadStatus === 'loading'}
            <div class="download-progress">
              <span class="spinner"></span>
              <span class="download-label">Downloading models…</span>
            </div>
          {:else if downloadStatus === 'done'}
            <div class="download-done">
              <span class="check-mark">&#10003;</span>
              <span class="download-label">Models ready</span>
            </div>
          {:else if downloadStatus === 'error'}
            <div class="download-error">
              <p class="error-text">Failed: {downloadError}</p>
              <button class="btn-download btn-retry" onclick={handlePreDownload}>Retry</button>
            </div>
            <p class="step-body step-note">
              You can skip this — models will try to download on first use.
            </p>
          {/if}
        </div>
      </div>

    {:else if step === 3}
      <div class="step-content">
        <p class="step-body">
          For richer analysis, connect an LLM via any <strong>OpenAI-compatible</strong> API
          endpoint. This enables tier-3 enrichment: narrative roles, concept descriptions,
          and story-driven scene composition.
        </p>
        <div class="field">
          <label for="onboard-endpoint" class="field-label">LLM Endpoint</label>
          <input
            id="onboard-endpoint"
            type="url"
            bind:value={endpoint}
            class="field-input"
            placeholder="http://localhost:11434/v1"
          />
          <p class="field-hint">e.g. Ollama, vLLM, or any OpenAI-compatible server</p>
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
        <p class="step-body step-note">
          You can change these later in Settings. LLM is optional — the app works
          without it using local NLP models.
        </p>
      </div>

    {:else if step === 4}
      <div class="step-content">
        <p class="step-body">
          Choose a scene to start with. You can always create new scenes later.
        </p>
        <div class="scene-options">
          <button class="scene-card" onclick={() => handleStart('default')}>
            <span class="scene-name">Terran System</span>
            <span class="scene-desc">A pre-built solar system demo. Great for seeing what the app can do.</span>
          </button>
          <button class="scene-card scene-card-secondary" onclick={() => handleStart('empty')}>
            <span class="scene-name">Empty Scene</span>
            <span class="scene-desc">A blank canvas. Start from scratch with your own concepts.</span>
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <div class="wizard-nav">
      {#if step > 1}
        <button class="btn-nav" onclick={() => step--}>Back</button>
      {:else}
        <div></div>
      {/if}

      <div class="step-dots">
        {#each [1, 2, 3, 4] as s}
          <span class="dot" class:dot-active={s === step} class:dot-done={s < step}></span>
        {/each}
      </div>

      {#if step < 4}
        <button class="btn-nav btn-next" onclick={() => step++}>Next</button>
      {:else}
        <div></div>
      {/if}
    </div>
  {/snippet}
</GlassModal>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step-body {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  .step-note {
    font-size: 12px;
    color: var(--text-muted);
  }

  .step-list {
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-secondary);
    margin: 0;
    padding-left: 20px;
  }

  /* NLP info card */
  .info-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
  }

  .info-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .info-detail {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin: 0;
  }

  .info-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
  }

  /* Download section */
  .download-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .btn-download {
    padding: 8px 18px;
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

  .btn-download:hover {
    opacity: 0.9;
  }

  .btn-retry {
    padding: 6px 14px;
    font-size: 12px;
  }

  .download-progress,
  .download-done,
  .download-error {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .download-label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--glass-border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .check-mark {
    font-size: 14px;
    color: #34d399;
    font-weight: 700;
  }

  .error-text {
    font-size: 12px;
    color: var(--danger);
    margin: 0;
  }

  /* LLM form fields */
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

  /* Scene choice cards */
  .scene-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .scene-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-main);
    transition: background 0.15s, border-color 0.15s;
  }

  .scene-card:hover {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .scene-card-secondary {
    border-color: var(--glass-border);
    background: transparent;
  }

  .scene-card-secondary:hover {
    background: var(--pad-btn-bg);
  }

  .scene-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .scene-desc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  /* Wizard footer navigation */
  .wizard-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .step-dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--glass-border);
    transition: background 0.15s;
  }

  .dot-active {
    background: var(--accent);
  }

  .dot-done {
    background: color-mix(in srgb, var(--accent) 50%, transparent);
  }

  .btn-nav {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-main);
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-nav:hover {
    background: var(--pad-btn-bg);
  }

  .btn-next {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .btn-next:hover {
    opacity: 0.9;
    background: var(--accent);
  }
</style>
