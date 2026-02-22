# Glass Modals, Onboarding, Status Bar & FPS — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert settings to a glass modal, add onboarding, add FPS counter with color-coded display, add Status/Settings controls to hex dial, and use SvelteKit shallow routing for URL-driven modals.

**Architecture:** Shared GlassModal component wraps Settings, Onboarding, and Help. SvelteKit shallow routing (`pushState` from `$app/navigation`) drives modal state from URL without page navigation. FPS is tracked in the PlayCanvas update loop and read via the existing rAF tick. StatusBar visibility is config-driven from hex dial "Status" face toggles.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, PlayCanvas, Tailwind CSS 4, CSS custom properties

---

### Task 1: Add FPS tracking to SceneController

**Files:**
- Modify: `src/lib/3d/createScene.ts:9-25` (SceneController interface)
- Modify: `src/lib/3d/createScene.ts:384-478` (update loop + controller return)

**Step 1: Add `getFps()` to the SceneController interface**

In `src/lib/3d/createScene.ts`, add `getFps` to the interface at line 24:

```ts
export interface SceneController {
  setTheme(theme: 'light' | 'dark'): void;
  toggleCameraMode(): CameraMode;
  setCameraMode(mode: CameraMode): void;
  getCameraMode(): CameraMode;
  setInput(action: string, active: boolean): void;
  lookAtOrigin(): void;
  getCompassAngle(): number;
  getFps(): number;
  loadContent(content: SceneContent): void;
  unloadContent(): void;
  getFollowableEntities(): string[];
  getFollowTarget(): string | null;
  cycleFollowTarget(): string | null;
  destroy(): void;
}
```

**Step 2: Add FPS counting state and logic**

Add FPS counter variables after `let time = 0;` (line 385):

```ts
let time = 0;
let fpsFrameCount = 0;
let fpsAccumTime = 0;
let currentFps = 0;
```

Add FPS calculation at the top of the `app.on('update')` callback (line 423, inside the callback before `time += dt`):

```ts
app.on('update', (dt: number) => {
  // FPS counter — accumulate frames, compute once per second
  fpsFrameCount++;
  fpsAccumTime += dt;
  if (fpsAccumTime >= 1.0) {
    currentFps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsAccumTime -= 1.0;
  }

  time += dt;
  // ... rest of existing update loop
```

**Step 3: Add getFps to the returned controller object**

Add after `getCompassAngle()` (around line 716):

```ts
getFps() {
  return currentFps;
},
```

**Step 4: Commit**

```bash
git add src/lib/3d/createScene.ts
git commit -m "feat: add FPS tracking to SceneController"
```

---

### Task 2: Create FPS color utility

**Files:**
- Create: `src/lib/3d/fps-color.ts`
- Create: `src/lib/3d/fps-color.test.ts`

**Step 1: Write the test**

Create `src/lib/3d/fps-color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fpsToColor } from './fps-color';

describe('fpsToColor', () => {
  it('returns dull red for very low FPS', () => {
    const result = fpsToColor(5);
    expect(result.color).toMatch(/^hsl\(/);
    expect(result.glow).toBe(false);
  });

  it('returns yellow-ish for 24-30 FPS', () => {
    const result = fpsToColor(27);
    expect(result.color).toMatch(/^hsl\(/);
    expect(result.glow).toBe(false);
  });

  it('returns green for 60 FPS', () => {
    const result = fpsToColor(60);
    expect(result.color).toMatch(/^hsl\(/);
    expect(result.glow).toBe(false);
  });

  it('returns green with glow for 90+ FPS', () => {
    const result = fpsToColor(120);
    expect(result.glow).toBe(true);
  });

  it('clamps at 0 FPS', () => {
    const result = fpsToColor(0);
    expect(result.color).toMatch(/^hsl\(/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/3d/fps-color.test.ts`
Expected: FAIL — module not found

**Step 3: Implement fpsToColor**

Create `src/lib/3d/fps-color.ts`:

```ts
export interface FpsColorResult {
  color: string;
  glow: boolean;
}

/**
 * Maps FPS to a color on a red→yellow→green gradient via HSL interpolation.
 *
 * Gradient stops:
 *   0 FPS  → hsl(0, 60%, 45%)    dull red
 *  24 FPS  → hsl(45, 80%, 50%)   yellow
 *  60 FPS  → hsl(142, 70%, 45%)  green
 *  90+ FPS → hsl(142, 80%, 55%)  bright green + glow
 */
export function fpsToColor(fps: number): FpsColorResult {
  const clamped = Math.max(0, fps);

  let h: number, s: number, l: number;

  if (clamped <= 24) {
    // 0→24: red (h=0) to yellow (h=45)
    const t = clamped / 24;
    h = t * 45;
    s = 60 + t * 20;       // 60% → 80%
    l = 45 + t * 5;        // 45% → 50%
  } else if (clamped <= 60) {
    // 24→60: yellow (h=45) to green (h=142)
    const t = (clamped - 24) / 36;
    h = 45 + t * 97;
    s = 80 - t * 10;       // 80% → 70%
    l = 50 - t * 5;        // 50% → 45%
  } else {
    // 60+: green, getting brighter toward 90
    const t = Math.min(1, (clamped - 60) / 30);
    h = 142;
    s = 70 + t * 10;       // 70% → 80%
    l = 45 + t * 10;       // 45% → 55%
  }

  return {
    color: `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`,
    glow: clamped >= 90,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/3d/fps-color.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/3d/fps-color.ts src/lib/3d/fps-color.test.ts
git commit -m "feat: add FPS-to-color gradient utility with tests"
```

---

### Task 3: Update StatusBar with FPS and config-driven visibility

**Files:**
- Modify: `src/lib/components/3d/StatusBar.svelte`

**Step 1: Update StatusBar component**

Replace the full content of `src/lib/components/3d/StatusBar.svelte`:

```svelte
<script lang="ts">
  import type { CameraMode } from '$lib/3d/createScene';
  import { fpsToColor } from '$lib/3d/fps-color';

  interface StatusBarConfig {
    fps: boolean;
    mode: boolean;
    movement: boolean;
    filename: boolean;
    bar: boolean;
  }

  interface Props {
    mode: 'command' | 'input';
    cameraMode: CameraMode;
    voiceRecording: boolean;
    activeFileName: string | null;
    fps?: number;
    config?: StatusBarConfig;
  }

  let {
    mode,
    cameraMode,
    voiceRecording,
    activeFileName,
    fps = 0,
    config = { fps: false, mode: true, movement: true, filename: true, bar: true },
  }: Props = $props();

  let fpsStyle = $derived.by(() => {
    const { color, glow } = fpsToColor(fps);
    return {
      color,
      textShadow: glow ? `0 0 6px ${color}` : 'none',
    };
  });
</script>

{#if config.bar}
<div class="status-bar">
  <div class="status-left">
    {#if config.mode}
      <span
        class="mode-badge"
        class:mode-command={mode === 'command'}
        class:mode-input={mode === 'input'}
      >
        {mode === 'command' ? 'COMMAND' : 'INPUT'}
      </span>
    {/if}
    {#if config.movement}
      <span class="camera-label">{cameraMode.toUpperCase()}</span>
    {/if}
    {#if config.fps}
      <span
        class="fps-label"
        style="color: {fpsStyle.color}; text-shadow: {fpsStyle.textShadow};"
      >FPS: {fps}</span>
    {/if}
  </div>

  <div class="status-right">
    {#if voiceRecording}
      <span class="mic-indicator">MIC</span>
    {/if}
    {#if config.filename && activeFileName}
      <span class="file-name">{activeFileName}</span>
    {/if}
  </div>
</div>
{/if}
```

Keep all existing `<style>` block and add this new rule inside it:

```css
.fps-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s;
}
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/StatusBar.svelte
git commit -m "feat: add FPS counter and config-driven visibility to StatusBar"
```

---

### Task 4: Create GlassModal component

**Files:**
- Create: `src/lib/components/3d/GlassModal.svelte`

**Step 1: Create the shared modal wrapper**

Create `src/lib/components/3d/GlassModal.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    onClose: () => void;
    maxWidth?: string;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    title,
    onClose,
    maxWidth = '480px',
    children,
    footer,
  }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
>
  <div
    class="modal-panel"
    style="max-width: {maxWidth};"
    role="dialog"
    aria-label={title}
  >
    <div class="modal-header">
      <h2 class="modal-title">{title}</h2>
      <button
        class="close-btn"
        onclick={onClose}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="modal-content">
      {@render children()}
    </div>

    {#if footer}
      <div class="modal-footer">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  }

  .modal-panel {
    width: 100%;
    margin: 0 16px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.08) 100%
    ), var(--glass-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--pad-btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px;
  }

  .modal-footer {
    flex-shrink: 0;
    padding: 12px 20px;
    border-top: 1px solid var(--glass-border);
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/GlassModal.svelte
git commit -m "feat: create shared GlassModal component"
```

---

### Task 5: Create SettingsModal component

**Files:**
- Create: `src/lib/components/3d/SettingsModal.svelte`

**Step 1: Create SettingsModal**

Create `src/lib/components/3d/SettingsModal.svelte`. This extracts the form from `src/routes/settings/+page.svelte` into the glass modal:

```svelte
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

  onMount(async () => {
    await settingsStore.init();
    const unsub = settingsStore.subscribe((s) => {
      endpoint = s.llmEndpoint;
      model = s.llmModel;
      theme = s.theme;
    });
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
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/SettingsModal.svelte
git commit -m "feat: create SettingsModal glass overlay component"
```

---

### Task 6: Create OnboardingModal component

**Files:**
- Create: `src/lib/components/3d/OnboardingModal.svelte`

**Step 1: Create OnboardingModal**

Create `src/lib/components/3d/OnboardingModal.svelte`:

```svelte
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

  onMount(async () => {
    await settingsStore.init();
    const unsub = settingsStore.subscribe((s) => {
      endpoint = s.llmEndpoint;
      model = s.llmModel;
    });
    return unsub;
  });

  async function handleGetStarted() {
    await settingsStore.update({
      llmEndpoint: endpoint,
      llmModel: model,
    });
    onClose();
  }
</script>

<GlassModal title="Welcome" {onClose} maxWidth="520px">
  <div class="onboarding">
    <p class="welcome-text">
      <strong>Concept Visualizer</strong> turns text into interactive 3D scenes.
      Type a concept in the chat input and watch it come to life. Configure your
      LLM endpoint below to get started.
    </p>

    <form onsubmit={(e) => { e.preventDefault(); handleGetStarted(); }} class="onboarding-form">
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

      <button type="submit" class="btn-start">Get Started</button>
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
    align-self: flex-start;
  }

  .btn-start:hover {
    opacity: 0.9;
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/OnboardingModal.svelte
git commit -m "feat: create OnboardingModal for first-time setup"
```

---

### Task 7: Refactor KeyboardHelp to use GlassModal + add "Run Setup" link

**Files:**
- Modify: `src/lib/components/3d/KeyboardHelp.svelte`

**Step 1: Refactor KeyboardHelp**

The component currently has its own backdrop, panel, header, and close button. Replace that chrome with `GlassModal`. Add an `onRunSetup` callback prop and a footer link.

Update the Props interface:

```ts
interface Props {
  bays: HexBayConfig[];
  activeBayIndex: number;
  onClose: () => void;
  onRunSetup?: () => void;
}
```

Replace the template. Remove the outer `<svelte:window>`, the backdrop `<div>`, and the `help-panel` div (GlassModal handles all of that). Keep all the shortcut section content.

The component should import `GlassModal` and wrap the content:

```svelte
<script lang="ts">
  import type { HexBayConfig } from './hexagon-dial.types';
  import GlassModal from './GlassModal.svelte';

  interface Props {
    bays: HexBayConfig[];
    activeBayIndex: number;
    onClose: () => void;
    onRunSetup?: () => void;
  }

  let { bays, activeBayIndex, onClose, onRunSetup }: Props = $props();

  let activeBay = $derived(bays[activeBayIndex]);
  const POSITION_KEYS = ['O', ';', '.', ',', 'M', 'K'];
  let hexShortcuts = $derived(
    POSITION_KEYS.map((key, i) => ({
      key,
      label: activeBay.faces[i].label,
    }))
  );
</script>

<GlassModal title="Keyboard Shortcuts" {onClose} maxWidth="540px">
  <!-- All shortcut sections go here (Global, Camera Movement, Hex Dial, Mouse) -->
  <!-- Keep them exactly as they are now, just without the outer panel/header/close -->

  {#snippet footer()}
    {#if onRunSetup}
      <button class="setup-link" onclick={onRunSetup}>
        Run Setup Wizard
      </button>
    {/if}
  {/snippet}
</GlassModal>
```

Move the shortcut sections (Global, Camera Movement, Hex Dial, Mouse) into the `children` slot area of GlassModal.

**Important:** The footer snippet must be passed as a named snippet to GlassModal. Use the `{#snippet footer()}...{/snippet}` syntax inside the GlassModal tag block.

Remove these styles from KeyboardHelp (they're now in GlassModal): `.help-panel`, `.close-btn`, `.close-btn:hover`. Keep all shortcut-related styles (`.shortcut-group`, `.group-title`, `.bay-badge`, `.shortcut-grid`, `.shortcut-row`, `kbd`, etc.).

Add the setup link style:

```css
.setup-link {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: var(--font-main);
  transition: opacity 0.15s;
}

.setup-link:hover {
  opacity: 0.8;
}
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/KeyboardHelp.svelte
git commit -m "refactor: KeyboardHelp uses GlassModal, adds Run Setup link"
```

---

### Task 8: Update hex dial bays — replace Environment and Objects

**Files:**
- Modify: `src/lib/components/3d/hexagon-dial-bays.ts`

**Step 1: Replace Environment (index 2) with Status, Objects (index 3) with Settings**

In `src/lib/components/3d/hexagon-dial-bays.ts`, replace the faces at index 2 and 3 in the `SCENE_BAY.faces` array:

Replace `environment` face (index 2, lines 39-50) with:

```ts
{
  id: 'status',
  label: 'Status',
  isToggle: false,
  options: [
    { id: 'fps', label: 'FPS' },
    { id: 'mode', label: 'Mode' },
    { id: 'movement', label: 'Movement' },
    { id: 'filename', label: 'File' },
    { id: 'bar', label: 'Bar' },
  ],
  // Monitor/stats icon
  iconPath:
    'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
},
```

Replace `objects` face (index 3, lines 51-62) with:

```ts
{
  id: 'settings',
  label: 'Settings',
  isToggle: true,
  options: [],
  // Gear icon
  iconPath:
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z',
},
```

Also update `DEFAULT_SELECTIONS` — remove `environment: 'void'` and `objects: 'all'`, add `status: 'mode'` (a dummy default, since status options are toggles handled specially):

```ts
export const DEFAULT_SELECTIONS: Record<string, string> = {
  // Scene bay
  scenes: 'list',
  theme: 'system',
  status: 'mode',
  settings: '',
  camera: 'orbit',
  effects: 'none',
  // App bay
  extractor: 'llm',
  viztype: 'graph',
  export: 'png',
  pipeline: 'auto',
  refinement: 'on',
  layout: 'hud',
};
```

**Step 2: Commit**

```bash
git add src/lib/components/3d/hexagon-dial-bays.ts
git commit -m "feat: replace Environment/Objects with Status/Settings in hex dial bay 1"
```

---

### Task 9: Wire everything into +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

This is the integration task. Multiple changes needed:

**Step 1: Add imports**

Add to the imports section at the top of `+page.svelte`:

```ts
import { pushState } from '$app/navigation';
import { page } from '$app/stores';
import SettingsModal from '$lib/components/3d/SettingsModal.svelte';
import OnboardingModal from '$lib/components/3d/OnboardingModal.svelte';
```

**Step 2: Add state variables**

Add after `let inputMode = $state(false);` (line 44):

```ts
let currentFps = $state(0);
let statusBarConfig = $state({
  fps: false,
  mode: true,
  movement: true,
  filename: true,
  bar: true,
});
let showOnboarding = $state(false);
```

**Step 3: Derive modal state from $page.state**

Add after the state variables:

```ts
// Modal state derived from shallow routing
let activeModal = $derived(($page as any).state?.modal as string | undefined);
let settingsVisible = $derived(activeModal === 'settings');
let helpVisible2 = $derived(activeModal === 'help');
```

Then replace the existing `let helpVisible = $state(false);` (line 38) — remove it. Replace all references to `helpVisible` with `helpVisible2` (or rename the derived to `helpVisible`). Since `helpVisible` was a `$state`, changing it to `$derived` from shallow routing means opening/closing works via `pushState`/`history.back()`.

Actually, to minimize diff, rename the derived:

```ts
let helpVisible = $derived(activeModal === 'help');
```

Remove the old `let helpVisible = $state(false);` line. This changes `helpVisible` from writable state to a derived. All reads work the same. All writes (`helpVisible = true/false`) need to change to `pushState`/`history.back()`.

**Step 4: Update help toggle handlers**

Replace `helpVisible = !helpVisible` with:

```ts
// Open help
function openHelp() {
  pushState('/help', { modal: 'help' });
}

// Close help / any modal
function closeModal() {
  history.back();
}
```

In `handleKeyDown`, replace `helpVisible = !helpVisible` with:
```ts
if (activeModal === 'help') {
  closeModal();
} else {
  openHelp();
}
```

Replace `helpVisible = false` in `routeKeyDown` handling with `closeModal()`.

**Step 5: Update FPS reading in the tick loop**

In the `onMount` callback, inside the `tick()` function (line 93-96):

```ts
function tick() {
  compassAngle = s.getCompassAngle();
  currentFps = s.getFps();
  raf = requestAnimationFrame(tick);
}
```

**Step 6: Wire settings modal open from hex dial**

In `handleDialToggle`, add handling for the settings face:

```ts
function handleDialToggle(faceId: string) {
  if (faceId === 'theme') {
    toggleTheme();
  } else if (faceId === 'settings') {
    pushState('/settings', { modal: 'settings' });
  }
}
```

**Step 7: Wire status bar toggles from hex dial**

In `handleDialSelect`, add handling for the status face:

```ts
if (faceId === 'status') {
  const key = optionId as keyof typeof statusBarConfig;
  if (key in statusBarConfig) {
    statusBarConfig = { ...statusBarConfig, [key]: !statusBarConfig[key] };
  }
  return;
}
```

**Step 8: Wire onboarding detection**

In the `onMount` callback, after `files3dStore.init()` block, add onboarding check:

```ts
// Check for first-time setup after settings are loaded
settingsStore.init().then(() => {
  const settings = get(settingsStore);
  // Show onboarding if endpoint is still the default (user hasn't configured)
  if (settings.llmEndpoint === 'http://localhost:11434/v1' && settings.llmModel === 'llama3.2') {
    showOnboarding = true;
  }
});
```

Note: `settingsStore.init()` is already called in `+layout.svelte`, so the settings may already be loaded. But calling init() again is safe (it's idempotent — just reads from DB).

Actually, looking at `+layout.svelte`, `settingsStore.init()` is called there. In `+page.svelte`, we already have `settingsStore.subscribe()` in the onMount. We can check after that subscription fires. Simpler approach — check in the existing `settingsStore.subscribe()` callback (line 127-133):

```ts
let hasCheckedOnboarding = false;
const unsub = settingsStore.subscribe((settings) => {
  if (!hasCheckedOnboarding) {
    hasCheckedOnboarding = true;
    if (settings.llmEndpoint === 'http://localhost:11434/v1' && settings.llmModel === 'llama3.2') {
      showOnboarding = true;
    }
  }
  // ... existing theme sync
});
```

**Step 9: Update the template**

Replace the help button click handler:
```svelte
onclick={() => { openHelp(); }}
```

Replace the `{#if helpVisible}` block:
```svelte
{#if helpVisible}
  <KeyboardHelp
    bays={dialBays}
    {activeBayIndex}
    onClose={closeModal}
    onRunSetup={() => { closeModal(); setTimeout(() => { showOnboarding = true; }, 100); }}
  />
{/if}
```

Add settings and onboarding modals after the help block:

```svelte
{#if settingsVisible}
  <SettingsModal onClose={closeModal} />
{/if}

{#if showOnboarding}
  <OnboardingModal onClose={() => { showOnboarding = false; }} />
{/if}
```

Update StatusBar props:
```svelte
<StatusBar
  mode={inputMode ? 'input' : 'command'}
  {cameraMode}
  voiceRecording={false}
  {activeFileName}
  fps={currentFps}
  config={statusBarConfig}
/>
```

**Step 10: Update routeKeyDown handling for modals**

In the `handleKeyDown` function, the `routeKeyDown` call uses `helpVisible` and `fileListVisible`. Since `helpVisible` is now derived from URL state, the read still works. But the write actions need updating.

Replace `case 'close_help': helpVisible = false; return;` with:
```ts
case 'close_help': closeModal(); return;
```

Also need to handle settings modal in `routeKeyDown`. If settings modal is open, Escape should close it. Update the call to include `settingsVisible`:

In `src/lib/3d/input-mode.ts`, check if it handles modal closing generically. If it only handles `helpVisible`, we may need to add `settingsVisible` to the context.

Actually, looking at the `routeKeyDown` function, it takes `{ inputMode, helpVisible, fileListVisible }`. When `settingsVisible` is true, we want Escape to close the modal. The simplest approach: treat `settingsVisible` the same as `helpVisible` — if any modal is open, Escape closes it.

Add `modalOpen` to the context:
```ts
const route = routeKeyDown(e.key, {
  inputMode,
  helpVisible: helpVisible || settingsVisible,
  fileListVisible,
});
```

And update the close_help handler to close whatever modal is open:
```ts
case 'close_help':
  if (settingsVisible || helpVisible) closeModal();
  return;
```

**Step 11: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: wire glass modals, FPS counter, status toggles, and onboarding"
```

---

### Task 10: Delete old settings route

**Files:**
- Delete: `src/routes/settings/+page.svelte`
- Modify: `src/lib/components/AppShell.svelte` (remove settings link — currently unused by 3D page but clean up the dead reference)

**Step 1: Delete the settings route**

```bash
rm src/routes/settings/+page.svelte
rmdir src/routes/settings
```

**Step 2: Remove settings link from AppShell**

In `src/lib/components/AppShell.svelte`, remove the settings link section (lines 27-29):

```html
<!-- Remove this block -->
<div class="p-3 w-56" style="border-top: 1px solid var(--border)">
  <a href="/settings" class="text-xs" style="color: var(--text-muted)">Settings</a>
</div>
```

Replace with just the closing tag area (no settings link needed since the 3D page uses hex dial):

```html
<!-- Keep sidebar content, remove settings link -->
```

Actually, AppShell is used as a layout wrapper. The 3D page (`+page.svelte`) doesn't use AppShell at all — it has its own full-screen layout. AppShell is only referenced if other routes used it. Since we're removing the settings route and the 3D page doesn't use it, just remove the dead `/settings` link.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete old settings route, remove stale settings link from AppShell"
```

---

### Task 11: Verify and fix — full integration test

**Step 1: Run type checking**

```bash
npm run check
```

Fix any type errors.

**Step 2: Run tests**

```bash
npx vitest run
```

Fix any test failures.

**Step 3: Run dev server and manual verification**

```bash
npm run dev
```

Verify:
- [ ] "," key or hex dial bottom face opens Settings modal
- [ ] "." key or hex dial bottom-right face opens Status fan-out with toggle options
- [ ] FPS counter appears in status bar when toggled on via Status face
- [ ] FPS color changes: red at low FPS, yellow mid, green at 60+, glows at 90+
- [ ] Status bar elements can be toggled individually
- [ ] "?" opens Help modal at `/help` URL
- [ ] Help modal has "Run Setup Wizard" link
- [ ] "Run Setup Wizard" opens onboarding
- [ ] Onboarding auto-shows on first launch (when settings are defaults)
- [ ] Back button closes modals
- [ ] Escape closes modals
- [ ] Old `/settings` route is gone (404 or redirects)

**Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for glass modals and status bar"
```

---

### Task 12: Address ground plane bug (separate from feature work)

The user reported that the default scene's ground is now a solid plane instead of a mesh (grid) after the DSL update. This should be investigated separately.

**Files to check:**
- `src/lib/3d/scenes/solar.ts` — the default scene definition
- `src/lib/3d/createScene.ts:100-161` — `buildGridFloor` and `buildEntity` functions
- `src/lib/3d/compositor.ts` — how layers map to SceneContent

**Step 1: Check the solar scene definition for the ground entity**

Look at how the ground entity is defined in the solar scene. After the DSL redesign, it likely lost the `opacity` property that triggers the grid floor path in `buildEntity`.

**Step 2: Fix the ground entity definition**

The `buildEntity` function (line 163-217) checks `if (spec.opacity)` to route to `buildGridFloor`. After the DSL redesign, the entity spec format changed. The `opacity` field may have moved or been removed during the `EntitySpec → SceneEntitySpec` mapping in the compositor.

Investigate and fix the mapping so the grid floor renders correctly.

**Step 3: Commit**

```bash
git add <fixed files>
git commit -m "fix: restore grid floor rendering after DSL redesign"
```
