# Glass Modals, Onboarding, Status Bar & FPS — Design

**Date:** 2026-02-22

## Overview

Convert the settings page into a glass modal overlay, add a first-time onboarding screen, make Help URL-driven, add a FPS counter to the status bar with color-coded framerate, and restructure hex dial bay 1 to include Settings and Status controls.

## 1. Shared GlassModal Component

**File:** `src/lib/components/3d/GlassModal.svelte`

A reusable modal wrapper used by Settings, Help, and Onboarding.

**Structure:**
- Full-screen backdrop: `rgba(0,0,0,0.4)` + `backdrop-filter: blur(4px)`
- Centered panel with glass styling (matches FileListModal pattern)
- Header: title text + close button (X)
- Scrollable content area (Svelte snippet)
- Optional footer slot (Svelte snippet)
- Escape key and click-outside close the modal
- Transitions: fade backdrop + scale panel

**Props:**
```ts
interface Props {
  title: string;
  onClose: () => void;
  maxWidth?: string;    // default '480px'
  children: Snippet;
  footer?: Snippet;
}
```

**Glass styling (consistent with existing modals):**
```css
background: linear-gradient(145deg, rgba(255,255,255,0.08), transparent 50%, rgba(0,0,0,0.08)),
            var(--glass-bg);
backdrop-filter: blur(20px);
border: 1px solid var(--glass-border);
border-radius: 12px;
box-shadow:
  inset 0 1px 1px rgba(255,255,255,0.1),
  0 8px 32px rgba(0,0,0,0.3),
  0 2px 8px rgba(0,0,0,0.2);
```

## 2. URL-Driven Modals via Shallow Routing

Use SvelteKit's `pushState` from `$app/navigation` for URL changes without page navigation. The 3D scene stays mounted.

```ts
import { pushState } from '$app/navigation';
import { page } from '$app/stores';

// Open
pushState('/settings', { modal: 'settings' });

// Read
$page.state.modal === 'settings'

// Close — go back
history.back();
```

**Routes:**
- `/settings` → Settings modal overlay
- `/help` → Help modal overlay
- `/onboarding` → Onboarding modal overlay (also auto-shown on first launch)

**Cleanup:** Delete `src/routes/settings/+page.svelte` and `src/routes/settings/` directory.

## 3. Settings Modal

**File:** `src/lib/components/3d/SettingsModal.svelte`

**Content:** Same three fields as current settings page:
- LLM Endpoint (URL input) with mixed-content warning
- Model (text input)
- Theme (select: Light/Dark)
- Save button: writes to `settingsStore`, closes modal
- Cancel/close: returns to `/`

**Trigger points:**
- "," key on hex dial (bay 1, bottom face)
- Direct URL navigation to `/settings`

## 4. Onboarding Screen

**File:** `src/lib/components/3d/OnboardingModal.svelte`

**Content:**
- Welcome heading + brief description of Concept Visualizer
- LLM Endpoint field (placeholder: `http://localhost:11434/v1`)
- Model field (placeholder: `llama3.2`)
- "Get Started" button: saves settings, closes modal

**Trigger:**
- **First launch:** If `settingsStore.llmEndpoint` is empty/default after init, auto-show
- **From Help:** "Run Setup" link in the Help modal footer

**Persistence:** Store a `hasCompletedOnboarding` flag in settings/IndexedDB to avoid re-showing after first completion (separate from whether settings are empty).

## 5. Help Modal Refactor

**File:** `src/lib/components/3d/KeyboardHelp.svelte` (modified)

**Changes:**
- Wrap content in `GlassModal` (remove its own backdrop/panel code)
- Add "Run Setup" button/link in footer to re-trigger onboarding
- URL: `pushState('/help', { modal: 'help' })`

## 6. Hex Dial Bay 1 Changes

### Replace "." face (bottom-right, index 2): Environment → Status

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
  iconPath: '...' // Monitor/stats icon
}
```

**Behavior:** Each option acts as a multi-toggle. Selecting an option flips its state. The fan-out shows visual indicators (filled dot or checkmark) next to enabled items.

**Default state:**
```ts
{ fps: false, mode: true, movement: true, filename: true, bar: true }
```

### Replace "," face (bottom, index 3): Objects → Settings

```ts
{
  id: 'settings',
  label: 'Settings',
  isToggle: false,
  options: [],  // No fan-out — direct action
  iconPath: '...' // Gear icon
}
```

**Behavior:** Clicking opens the Settings modal directly (no fan-out). The `handleDialSelect`/`handleDialToggle` handler detects `faceId === 'settings'` and calls `pushState('/settings', { modal: 'settings' })`.

### Removed faces
- **Environment** — dropped (not wired up)
- **Objects** — dropped (not wired up)

## 7. FPS Counter

### Scene-side (createScene.ts)

Add frame counting in the existing `app.on('update')` loop:

```ts
let frameCount = 0;
let fpsAccumTime = 0;
let currentFps = 0;

app.on('update', (dt: number) => {
  frameCount++;
  fpsAccumTime += dt;
  if (fpsAccumTime >= 1.0) {
    currentFps = frameCount;
    frameCount = 0;
    fpsAccumTime -= 1.0;
  }
  // ... existing animation/camera code
});
```

Expose via `SceneController`:
```ts
getFps(): number  // returns currentFps
```

### Page-side (+page.svelte)

Read FPS in the existing rAF tick loop (already runs for compass angle):
```ts
function tick() {
  compassAngle = s.getCompassAngle();
  currentFps = s.getFps();
  raf = requestAnimationFrame(tick);
}
```

### StatusBar display

Show `FPS: <num>` with color-coded text based on framerate:

| FPS Range | Color | HSL | Effect |
|-----------|-------|-----|--------|
| < 10 | Dull red | `hsl(0, 60%, 45%)` | — |
| 10–24 | Red→Yellow | Interpolated | — |
| 24–30 | Yellow | `hsl(45, 80%, 50%)` | — |
| 30–60 | Yellow→Green | Interpolated | — |
| 60–89 | Green | `hsl(142, 70%, 45%)` | — |
| 90+ | Bright green | `hsl(142, 80%, 55%)` | Soft glow via `text-shadow: 0 0 6px currentColor` |

**Implementation:** HSL interpolation function mapping FPS to a smooth color gradient. Hue goes from 0 (red) through 45 (yellow) to 142 (green).

**Performance:** Frame counting is `frameCount++` and one conditional per frame — negligible. FPS value is read in the existing rAF loop, not a separate timer.

## 8. StatusBar Changes

**File:** `src/lib/components/3d/StatusBar.svelte` (modified)

**New props:**
```ts
interface Props {
  mode: 'command' | 'input';
  cameraMode: CameraMode;
  voiceRecording: boolean;
  activeFileName: string | null;
  fps: number;
  config: {
    fps: boolean;
    mode: boolean;
    movement: boolean;
    filename: boolean;
    bar: boolean;
  };
}
```

**Conditional rendering:** Each element checks its config flag before rendering. If `config.bar` is false, the entire status bar is hidden.

**FPS element:** Positioned on the left side after the mode badge. Shows `FPS: 60` with color derived from the HSL interpolation function. Above 90 FPS, adds a soft green glow.

## 9. State Management

### Status bar config state

Lives in `+page.svelte` as reactive state:
```ts
let statusBarConfig = $state({
  fps: false,
  mode: true,
  movement: true,
  filename: true,
  bar: true,
});
```

The Status face on the hex dial toggles individual keys. The `handleDialSelect` handler for `faceId === 'status'` flips the corresponding config key.

### Modal state

Derived from `$page.state.modal` via shallow routing:
```ts
let activeModal = $derived($page.state?.modal as string | undefined);
let settingsVisible = $derived(activeModal === 'settings');
let helpVisible = $derived(activeModal === 'help');
let onboardingVisible = $derived(activeModal === 'onboarding');
```

## 10. File Changes Summary

| File | Action |
|------|--------|
| `src/lib/components/3d/GlassModal.svelte` | **Create** — shared modal wrapper |
| `src/lib/components/3d/SettingsModal.svelte` | **Create** — settings form in glass modal |
| `src/lib/components/3d/OnboardingModal.svelte` | **Create** — first-time setup in glass modal |
| `src/lib/components/3d/KeyboardHelp.svelte` | **Modify** — use GlassModal, add "Run Setup" link |
| `src/lib/components/3d/StatusBar.svelte` | **Modify** — add FPS counter, config-driven visibility |
| `src/lib/components/3d/hexagon-dial-bays.ts` | **Modify** — replace Environment→Status, Objects→Settings |
| `src/lib/3d/createScene.ts` | **Modify** — add FPS counting + getFps() |
| `src/routes/+page.svelte` | **Modify** — shallow routing, modal state, status config, FPS |
| `src/routes/settings/+page.svelte` | **Delete** |
| `src/routes/settings/` | **Delete** directory |
