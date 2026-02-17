# Gamepad UI/UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Layer a gamepad-inspired control system, adaptive color theming, Space Grotesk typography, node focus/zoom feedback, and three placement modes onto the existing Concept Visualizer app.

**Architecture:** A `KeyboardController` action module handles all key bindings and emits semantic events. A `GamepadControls` Svelte component renders the visual pad with three placement modes. A `focusStore` tracks selected node and zoom level, driving reactive updates in the concept details pane. The adaptive color system uses CSS custom properties derived from the active viz type.

**Tech Stack:** Svelte 5, TypeScript, Tailwind CSS 4, D3.js (existing), Space Grotesk (Google Fonts)

---

### Task 1: Add Space Grotesk Font and Adaptive CSS Custom Properties

**Files:**
- Modify: `src/app.html`
- Modify: `src/app.css`

**Step 1: Add Space Grotesk font import**

Modify `src/app.html` to add the Google Fonts link in the `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
```

**Step 2: Set up CSS custom properties and typography**

Replace `src/app.css` with:

```css
@import 'tailwindcss';

:root {
  --font-main: 'Space Grotesk', system-ui, sans-serif;

  /* Adaptive accent colors - default to graph (blue) */
  --accent: #3b82f6;
  --accent-light: #eff6ff;
  --accent-text: #1e40af;

  /* Glass surfaces */
  --glass-bg: rgba(255, 255, 255, 0.5);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-bg-hover: rgba(255, 255, 255, 0.6);

  /* Pad button */
  --pad-btn-bg: rgba(255, 255, 255, 0.3);
  --pad-btn-bg-hover: rgba(255, 255, 255, 0.6);
  --pad-btn-bg-active: rgba(59, 130, 246, 0.2);
}

/* Viz type accent overrides - applied via data attribute on body */
[data-viz-type="graph"] {
  --accent: #3b82f6;
  --accent-light: #eff6ff;
  --accent-text: #1e40af;
  --pad-btn-bg-active: rgba(59, 130, 246, 0.2);
}
[data-viz-type="tree"] {
  --accent: #10b981;
  --accent-light: #ecfdf5;
  --accent-text: #065f46;
  --pad-btn-bg-active: rgba(16, 185, 129, 0.2);
}
[data-viz-type="flowchart"] {
  --accent: #f59e0b;
  --accent-light: #fffbeb;
  --accent-text: #92400e;
  --pad-btn-bg-active: rgba(245, 158, 11, 0.2);
}
[data-viz-type="hierarchy"] {
  --accent: #8b5cf6;
  --accent-light: #f5f3ff;
  --accent-text: #5b21b6;
  --pad-btn-bg-active: rgba(139, 92, 246, 0.2);
}

/* Dark mode */
[data-theme="dark"] {
  --glass-bg: rgba(0, 0, 0, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-bg-hover: rgba(0, 0, 0, 0.5);
  --pad-btn-bg: rgba(255, 255, 255, 0.1);
  --pad-btn-bg-hover: rgba(255, 255, 255, 0.2);
}

body {
  font-family: var(--font-main);
}
```

**Step 3: Verify font loads**

Run: `npm run dev -- --port 5173`
Expected: All text renders in Space Grotesk.

**Step 4: Commit**

```bash
git add src/app.html src/app.css && git commit -m "feat: add Space Grotesk font and adaptive CSS custom properties

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Focus Store and Viz Type Accent Store

**Files:**
- Create: `src/lib/stores/focus.ts`
- Test: `src/lib/stores/focus.test.ts`
- Modify: `src/lib/stores/visualization.ts`

**Step 1: Write failing test for focus store**

Create `src/lib/stores/focus.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { focusStore } from './focus';

describe('focusStore', () => {
  beforeEach(() => {
    focusStore.clear();
  });

  it('should start with no focused node', () => {
    const state = get(focusStore);
    expect(state.focusedNodeId).toBeNull();
    expect(state.zoomLevel).toBe(1);
  });

  it('should focus a node', () => {
    focusStore.focusNode('node-a');
    const state = get(focusStore);
    expect(state.focusedNodeId).toBe('node-a');
  });

  it('should clear focus', () => {
    focusStore.focusNode('node-a');
    focusStore.clear();
    const state = get(focusStore);
    expect(state.focusedNodeId).toBeNull();
  });

  it('should zoom in and out', () => {
    focusStore.zoomIn();
    expect(get(focusStore).zoomLevel).toBeGreaterThan(1);
    focusStore.zoomOut();
    focusStore.zoomOut();
    expect(get(focusStore).zoomLevel).toBeLessThan(1);
  });

  it('should clamp zoom between 0.3 and 3', () => {
    for (let i = 0; i < 20; i++) focusStore.zoomIn();
    expect(get(focusStore).zoomLevel).toBe(3);
    for (let i = 0; i < 40; i++) focusStore.zoomOut();
    expect(get(focusStore).zoomLevel).toBe(0.3);
  });

  it('should reset zoom on fitToScreen', () => {
    focusStore.zoomIn();
    focusStore.zoomIn();
    focusStore.fitToScreen();
    const state = get(focusStore);
    expect(state.zoomLevel).toBe(1);
    expect(state.focusedNodeId).toBeNull();
  });

  it('should navigate to next and previous node', () => {
    const nodeIds = ['a', 'b', 'c'];
    focusStore.setNodeIds(nodeIds);
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('a');
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('b');
    focusStore.focusPrev();
    expect(get(focusStore).focusedNodeId).toBe('a');
  });

  it('should wrap around on next/prev', () => {
    focusStore.setNodeIds(['a', 'b']);
    focusStore.focusNode('b');
    focusStore.focusNext();
    expect(get(focusStore).focusedNodeId).toBe('a');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/focus.test.ts`
Expected: FAIL -- module not found.

**Step 3: Implement focus store**

Create `src/lib/stores/focus.ts`:

```typescript
import { writable, get } from 'svelte/store';

interface FocusState {
  focusedNodeId: string | null;
  zoomLevel: number;
  nodeIds: string[];
}

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

function createFocusStore() {
  const { subscribe, set, update } = writable<FocusState>({
    focusedNodeId: null,
    zoomLevel: 1,
    nodeIds: []
  });

  function focusNode(id: string) {
    update(s => ({ ...s, focusedNodeId: id }));
  }

  function clear() {
    set({ focusedNodeId: null, zoomLevel: 1, nodeIds: [] });
  }

  function setNodeIds(ids: string[]) {
    update(s => ({ ...s, nodeIds: ids }));
  }

  function zoomIn() {
    update(s => ({
      ...s,
      zoomLevel: Math.min(ZOOM_MAX, Math.round((s.zoomLevel + ZOOM_STEP) * 100) / 100)
    }));
  }

  function zoomOut() {
    update(s => ({
      ...s,
      zoomLevel: Math.max(ZOOM_MIN, Math.round((s.zoomLevel - ZOOM_STEP) * 100) / 100)
    }));
  }

  function fitToScreen() {
    update(s => ({ ...s, zoomLevel: 1, focusedNodeId: null }));
  }

  function focusNext() {
    update(s => {
      if (s.nodeIds.length === 0) return s;
      if (s.focusedNodeId === null) {
        return { ...s, focusedNodeId: s.nodeIds[0] };
      }
      const idx = s.nodeIds.indexOf(s.focusedNodeId);
      const nextIdx = (idx + 1) % s.nodeIds.length;
      return { ...s, focusedNodeId: s.nodeIds[nextIdx] };
    });
  }

  function focusPrev() {
    update(s => {
      if (s.nodeIds.length === 0) return s;
      if (s.focusedNodeId === null) {
        return { ...s, focusedNodeId: s.nodeIds[s.nodeIds.length - 1] };
      }
      const idx = s.nodeIds.indexOf(s.focusedNodeId);
      const prevIdx = (idx - 1 + s.nodeIds.length) % s.nodeIds.length;
      return { ...s, focusedNodeId: s.nodeIds[prevIdx] };
    });
  }

  return {
    subscribe,
    focusNode,
    clear,
    setNodeIds,
    zoomIn,
    zoomOut,
    fitToScreen,
    focusNext,
    focusPrev
  };
}

export const focusStore = createFocusStore();
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stores/focus.test.ts`
Expected: All 8 tests PASS.

**Step 5: Add activeVizType to visualization store**

Modify `src/lib/stores/visualization.ts`. Add a `vizType` field to `VizState` that tracks the current type for accent theming:

Add to the `VizState` interface:
```typescript
vizType: VisualizationType | null;
```

Update `setVisualization`:
```typescript
function setVisualization(viz: VisualizationSchema) {
  set({ current: viz, loading: false, error: null, vizType: viz.type });
}
```

Update initial state to include `vizType: null`.

Add a `setVizType` method:
```typescript
function setVizType(type: VisualizationType) {
  update(s => ({ ...s, vizType: type }));
}
```

Update `clear` to reset `vizType: null`.

Return `setVizType` from the store.

**Step 6: Commit**

```bash
git add src/lib/stores/focus.ts src/lib/stores/focus.test.ts src/lib/stores/visualization.ts && git commit -m "feat: add focus store for node navigation/zoom and viz type tracking

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Keyboard Controller

**Files:**
- Create: `src/lib/controllers/keyboard.ts`
- Test: `src/lib/controllers/keyboard.test.ts`

**Step 1: Write failing test for keyboard controller**

Create `src/lib/controllers/keyboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createKeyboardController, type PadAction } from './keyboard';

describe('KeyboardController', () => {
  let controller: ReturnType<typeof createKeyboardController>;
  let actions: PadAction[];

  beforeEach(() => {
    actions = [];
    controller = createKeyboardController({
      onAction: (action) => actions.push(action),
      isTextInputFocused: () => false
    });
    controller.attach();
  });

  afterEach(() => {
    controller.detach();
  });

  function press(key: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  function release(key: string) {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  }

  it('should map Z to zoom_in', () => {
    press('z');
    expect(actions).toContain('zoom_in');
  });

  it('should map X to zoom_out', () => {
    press('x');
    expect(actions).toContain('zoom_out');
  });

  it('should map w/a/s/d to focus navigation', () => {
    press('w');
    press('a');
    press('s');
    press('d');
    expect(actions).toEqual(['focus_up', 'focus_left', 'focus_down', 'focus_right']);
  });

  it('should map Space to fit_to_screen', () => {
    press(' ');
    expect(actions).toContain('fit_to_screen');
  });

  it('should map Enter to visualize', () => {
    press('Enter');
    expect(actions).toContain('visualize');
  });

  it('should map Tab to cycle_viz_type', () => {
    press('Tab');
    expect(actions).toContain('cycle_viz_type');
  });

  it('should map p to export', () => {
    press('p');
    expect(actions).toContain('export');
  });

  it('should map q to toggle_auto_send', () => {
    press('q');
    expect(actions).toContain('toggle_auto_send');
  });

  it('should map Escape to deselect', () => {
    press('Escape');
    expect(actions).toContain('deselect');
  });

  it('should map arrow keys to pan', () => {
    press('ArrowUp');
    press('ArrowDown');
    press('ArrowLeft');
    press('ArrowRight');
    expect(actions).toEqual(['pan_up', 'pan_down', 'pan_left', 'pan_right']);
  });

  it('should not fire when text input is focused', () => {
    controller.detach();
    controller = createKeyboardController({
      onAction: (action) => actions.push(action),
      isTextInputFocused: () => true
    });
    controller.attach();

    press('z');
    // Only Escape should work when text is focused
    expect(actions).not.toContain('zoom_in');
  });

  it('should track held keys via activeKeys', () => {
    press('z');
    expect(controller.activeKeys()).toContain('z');
    release('z');
    expect(controller.activeKeys()).not.toContain('z');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/controllers/keyboard.test.ts`
Expected: FAIL -- module not found.

**Step 3: Implement keyboard controller**

Create `src/lib/controllers/keyboard.ts`:

```typescript
export type PadAction =
  | 'zoom_in' | 'zoom_out'
  | 'focus_up' | 'focus_down' | 'focus_left' | 'focus_right'
  | 'fit_to_screen'
  | 'pan_up' | 'pan_down' | 'pan_left' | 'pan_right'
  | 'visualize' | 'cycle_viz_type' | 'export' | 'toggle_auto_send'
  | 'deselect';

const KEY_MAP: Record<string, PadAction> = {
  'z': 'zoom_in',
  'x': 'zoom_out',
  'w': 'focus_up',
  'a': 'focus_left',
  's': 'focus_down',
  'd': 'focus_right',
  ' ': 'fit_to_screen',
  'ArrowUp': 'pan_up',
  'ArrowDown': 'pan_down',
  'ArrowLeft': 'pan_left',
  'ArrowRight': 'pan_right',
  'Enter': 'visualize',
  'Tab': 'cycle_viz_type',
  'p': 'export',
  'q': 'toggle_auto_send',
  'Escape': 'deselect'
};

// Actions that should fire only once per press (not repeat)
const DISCRETE_ACTIONS: Set<PadAction> = new Set([
  'fit_to_screen', 'visualize', 'cycle_viz_type',
  'export', 'toggle_auto_send', 'deselect'
]);

// Keys that work even when text input is focused
const ALWAYS_ACTIVE: Set<string> = new Set(['Escape']);

interface KeyboardControllerOptions {
  onAction: (action: PadAction) => void;
  isTextInputFocused: () => boolean;
}

export function createKeyboardController(options: KeyboardControllerOptions) {
  const heldKeys = new Set<string>();

  function handleKeyDown(e: KeyboardEvent) {
    const key = e.key;
    const action = KEY_MAP[key];
    if (!action) return;

    // Skip if text input focused (except always-active keys)
    if (options.isTextInputFocused() && !ALWAYS_ACTIVE.has(key)) return;

    // Prevent default for mapped keys
    if (key === 'Tab' || key === ' ') e.preventDefault();

    // For discrete actions, don't repeat on held key
    if (DISCRETE_ACTIONS.has(action) && heldKeys.has(key)) return;

    heldKeys.add(key);
    options.onAction(action);
  }

  function handleKeyUp(e: KeyboardEvent) {
    heldKeys.delete(e.key);
  }

  function attach() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  function detach() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    heldKeys.clear();
  }

  function activeKeys(): Set<string> {
    return new Set(heldKeys);
  }

  return { attach, detach, activeKeys };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/controllers/keyboard.test.ts`
Expected: All 12 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/controllers/ && git commit -m "feat: add keyboard controller with full key-to-action mapping

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Pad Button Component and SVG Icons

**Files:**
- Create: `src/lib/components/controls/PadButton.svelte`
- Create: `src/lib/components/controls/icons.ts`

**Step 1: Create SVG icon definitions**

Create `src/lib/components/controls/icons.ts`:

```typescript
// Each icon is an SVG path string for a 24x24 viewBox
export const icons: Record<string, string> = {
  // Nav cluster
  focus_up: 'M12 4l-6 6h4v8h4v-8h4l-6-6z',
  focus_down: 'M12 20l6-6h-4V6h-4v8H6l6 6z',
  focus_left: 'M4 12l6-6v4h8v4h-8v4l-6-6z',
  focus_right: 'M20 12l-6-6v4H6v4h8v4l6-6z',
  fit_to_screen: 'M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z',

  // Zoom pair
  zoom_in: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2V7z',
  zoom_out: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7V9z',

  // Action cluster
  visualize: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
  cycle_viz_type: 'M12 6V2L7 7l5 5V8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  export: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  toggle_auto_send: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',

  // Placement toggle
  placement: 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z',

  // Viz type indicators
  viz_graph: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14a2 2 0 110-4 2 2 0 010 4zm4-4a2 2 0 110-4 2 2 0 010 4zm2-6a2 2 0 110-4 2 2 0 010 4z',
  viz_tree: 'M12 2L6 8h3v4H6l6 6 6-6h-3V8h3L12 2z',
  viz_flowchart: 'M4 6h16v4H4V6zm2 6h12v4H6v-4zm4 6h4v4h-4v-4z',
  viz_hierarchy: 'M3 3h18v4H3V3zm2 6h14v4H5V9zm4 6h6v4H9v-4z'
};

// Key label for each action
export const keyLabels: Record<string, string> = {
  focus_up: 'W',
  focus_down: 'S',
  focus_left: 'A',
  focus_right: 'D',
  fit_to_screen: '␣',
  zoom_in: 'Z',
  zoom_out: 'X',
  visualize: '↵',
  cycle_viz_type: '⇥',
  export: 'P',
  toggle_auto_send: 'Q'
};
```

**Step 2: Create PadButton component**

Create `src/lib/components/controls/PadButton.svelte`:

```svelte
<script lang="ts">
  import { icons, keyLabels } from './icons';
  import type { PadAction } from '$lib/controllers/keyboard';

  interface Props {
    action: PadAction;
    active?: boolean;
    disabled?: boolean;
    onclick: () => void;
    showKeyHint?: boolean;
    size?: number;
  }

  let {
    action,
    active = false,
    disabled = false,
    onclick,
    showKeyHint = false,
    size = 40
  }: Props = $props();

  const iconPath = $derived(icons[action] ?? '');
  const keyLabel = $derived(keyLabels[action] ?? '');
</script>

<button
  class="relative rounded-full flex items-center justify-center transition-all duration-100 outline-none
    {disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
    {active ? 'scale-95' : ''}"
  style="
    width: {size}px;
    height: {size}px;
    background: {active ? 'var(--pad-btn-bg-active)' : 'var(--pad-btn-bg)'};
  "
  style:box-shadow={active ? '0 0 12px var(--accent)' : 'none'}
  {disabled}
  onclick={() => { if (!disabled) onclick(); }}
  title="{action} ({keyLabel})"
>
  <svg
    width={size * 0.5}
    height={size * 0.5}
    viewBox="0 0 24 24"
    fill={active ? 'var(--accent)' : '#4b5563'}
  >
    <path d={iconPath} />
  </svg>

  {#if showKeyHint && keyLabel}
    <span
      class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-medium opacity-60"
      style="color: {active ? 'var(--accent)' : '#6b7280'}"
    >
      {keyLabel}
    </span>
  {/if}
</button>
```

**Step 3: Commit**

```bash
git add src/lib/components/controls/ && git commit -m "feat: add PadButton component with SVG icons and key hint labels

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: GamepadControls Component (Three Placement Modes)

**Files:**
- Create: `src/lib/components/controls/NavCluster.svelte`
- Create: `src/lib/components/controls/ZoomPair.svelte`
- Create: `src/lib/components/controls/ActionCluster.svelte`
- Create: `src/lib/components/controls/GamepadControls.svelte`
- Create: `src/lib/components/controls/PlacementToggle.svelte`

**Step 1: Create NavCluster**

Create `src/lib/components/controls/NavCluster.svelte`:

```svelte
<script lang="ts">
  import PadButton from './PadButton.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    showKeyHints: boolean;
  }

  let { activeActions, onAction, showKeyHints }: Props = $props();
</script>

<div class="relative w-[130px] h-[130px]">
  <!-- W - top -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2">
    <PadButton action="focus_up" active={activeActions.has('focus_up')} onclick={() => onAction('focus_up')} showKeyHint={showKeyHints} />
  </div>
  <!-- A - left -->
  <div class="absolute top-1/2 left-0 -translate-y-1/2">
    <PadButton action="focus_left" active={activeActions.has('focus_left')} onclick={() => onAction('focus_left')} showKeyHint={showKeyHints} />
  </div>
  <!-- Space - center -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
    <PadButton action="fit_to_screen" active={activeActions.has('fit_to_screen')} onclick={() => onAction('fit_to_screen')} showKeyHint={showKeyHints} size={36} />
  </div>
  <!-- D - right -->
  <div class="absolute top-1/2 right-0 -translate-y-1/2">
    <PadButton action="focus_right" active={activeActions.has('focus_right')} onclick={() => onAction('focus_right')} showKeyHint={showKeyHints} />
  </div>
  <!-- S - bottom -->
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2">
    <PadButton action="focus_down" active={activeActions.has('focus_down')} onclick={() => onAction('focus_down')} showKeyHint={showKeyHints} />
  </div>
</div>
```

**Step 2: Create ZoomPair**

Create `src/lib/components/controls/ZoomPair.svelte`:

```svelte
<script lang="ts">
  import PadButton from './PadButton.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    showKeyHints: boolean;
  }

  let { activeActions, onAction, showKeyHints }: Props = $props();
</script>

<div class="flex gap-3 items-center">
  <PadButton action="zoom_in" active={activeActions.has('zoom_in')} onclick={() => onAction('zoom_in')} showKeyHint={showKeyHints} />
  <PadButton action="zoom_out" active={activeActions.has('zoom_out')} onclick={() => onAction('zoom_out')} showKeyHint={showKeyHints} />
</div>
```

**Step 3: Create ActionCluster**

Create `src/lib/components/controls/ActionCluster.svelte`:

```svelte
<script lang="ts">
  import PadButton from './PadButton.svelte';
  import { icons } from './icons';
  import type { PadAction } from '$lib/controllers/keyboard';
  import type { VisualizationType } from '$lib/types';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    showKeyHints: boolean;
    vizType: VisualizationType | null;
    autoSendOn: boolean;
  }

  let { activeActions, onAction, showKeyHints, vizType, autoSendOn }: Props = $props();

  const vizTypeIcon = $derived(vizType ? icons[`viz_${vizType}`] : icons['viz_graph']);
</script>

<div class="relative w-[130px] h-[130px]">
  <!-- Enter - top -->
  <div class="absolute top-0 left-1/2 -translate-x-1/2">
    <PadButton action="visualize" active={activeActions.has('visualize')} onclick={() => onAction('visualize')} showKeyHint={showKeyHints} />
  </div>
  <!-- Tab - left -->
  <div class="absolute top-1/2 left-0 -translate-y-1/2">
    <PadButton action="cycle_viz_type" active={activeActions.has('cycle_viz_type')} onclick={() => onAction('cycle_viz_type')} showKeyHint={showKeyHints} />
  </div>
  <!-- Center indicator -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
    <div class="w-7 h-7 rounded-full flex items-center justify-center" style="background: var(--accent)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d={vizTypeIcon} />
      </svg>
    </div>
  </div>
  <!-- P - right -->
  <div class="absolute top-1/2 right-0 -translate-y-1/2">
    <PadButton action="export" active={activeActions.has('export')} onclick={() => onAction('export')} showKeyHint={showKeyHints} />
  </div>
  <!-- Q - bottom -->
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2">
    <PadButton action="toggle_auto_send" active={activeActions.has('toggle_auto_send')} onclick={() => onAction('toggle_auto_send')} showKeyHint={showKeyHints} />
  </div>
</div>
```

**Step 4: Create PlacementToggle**

Create `src/lib/components/controls/PlacementToggle.svelte`:

```svelte
<script lang="ts">
  export type PlacementMode = 'hud' | 'dock' | 'embedded';

  interface Props {
    current: PlacementMode;
    onChange: (mode: PlacementMode) => void;
  }

  let { current, onChange }: Props = $props();
  let open = $state(false);

  const modes: { value: PlacementMode; label: string }[] = [
    { value: 'hud', label: 'Floating' },
    { value: 'dock', label: 'Dock' },
    { value: 'embedded', label: 'Embedded' }
  ];
</script>

<div class="relative">
  <button
    class="w-6 h-6 rounded flex items-center justify-center transition-colors"
    style="background: var(--pad-btn-bg)"
    onclick={() => open = !open}
    title="Change control placement"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#6b7280">
      <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
    </svg>
  </button>

  {#if open}
    <div class="absolute bottom-full mb-1 right-0 rounded-lg py-1 min-w-[100px] shadow-lg"
      style="background: var(--glass-bg); backdrop-filter: blur(16px); border: 1px solid var(--glass-border)">
      {#each modes as mode}
        <button
          class="w-full text-left px-3 py-1 text-xs transition-colors
            {current === mode.value ? 'font-medium' : ''}"
          style="color: {current === mode.value ? 'var(--accent)' : '#6b7280'}"
          onclick={() => { onChange(mode.value); open = false; }}
        >
          {mode.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
```

**Step 5: Create GamepadControls main component**

Create `src/lib/components/controls/GamepadControls.svelte`:

```svelte
<script lang="ts">
  import NavCluster from './NavCluster.svelte';
  import ZoomPair from './ZoomPair.svelte';
  import ActionCluster from './ActionCluster.svelte';
  import PlacementToggle, { type PlacementMode } from './PlacementToggle.svelte';
  import type { PadAction } from '$lib/controllers/keyboard';
  import type { VisualizationType } from '$lib/types';

  interface Props {
    activeActions: Set<PadAction>;
    onAction: (action: PadAction) => void;
    vizType: VisualizationType | null;
    autoSendOn: boolean;
    placement: PlacementMode;
    onPlacementChange: (mode: PlacementMode) => void;
  }

  let { activeActions, onAction, vizType, autoSendOn, placement, onPlacementChange }: Props = $props();
  let showKeyHints = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = $state(true);

  // For HUD mode: fade in on activity, fade out after idle
  function resetIdle() {
    idle = false;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idle = true; }, 3000);
  }

  $effect(() => {
    if (activeActions.size > 0) resetIdle();
  });
</script>

<svelte:window onmousemove={() => { if (placement === 'hud') resetIdle(); }} />

{#if placement === 'hud'}
  <!-- Floating HUD: left and right clusters in bottom corners of canvas -->
  <div
    class="absolute bottom-6 left-6 z-20 flex flex-col gap-4 items-center transition-opacity duration-300 rounded-2xl p-3"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      opacity: {idle ? 0.4 : 1};
    "
    onmouseenter={() => { showKeyHints = true; resetIdle(); }}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    aria-label="Navigation controls"
  >
    <NavCluster {activeActions} {onAction} {showKeyHints} />
    <ZoomPair {activeActions} {onAction} {showKeyHints} />
  </div>

  <div
    class="absolute bottom-6 right-6 z-20 flex flex-col gap-2 items-end transition-opacity duration-300 rounded-2xl p-3"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      opacity: {idle ? 0.4 : 1};
    "
    onmouseenter={() => { showKeyHints = true; resetIdle(); }}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    aria-label="Action controls"
  >
    <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
    <PlacementToggle current={placement} onChange={onPlacementChange} />
  </div>

{:else if placement === 'dock'}
  <!-- Bottom dock: horizontal bar below canvas -->
  <div
    class="w-full flex items-center justify-between px-6 py-2 rounded-none"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--glass-border);
      height: 56px;
    "
    onmouseenter={() => showKeyHints = true}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    aria-label="Controls dock"
  >
    <div class="flex items-center gap-6">
      <NavCluster {activeActions} {onAction} {showKeyHints} />
      <ZoomPair {activeActions} {onAction} {showKeyHints} />
    </div>
    <div class="flex items-center gap-4">
      <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
      <PlacementToggle current={placement} onChange={onPlacementChange} />
    </div>
  </div>

{:else if placement === 'embedded'}
  <!-- Embedded in editor pane -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-gray-200"
    onmouseenter={() => showKeyHints = true}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    aria-label="Controls"
  >
    <div class="flex items-center gap-4">
      <NavCluster {activeActions} {onAction} {showKeyHints} />
      <ZoomPair {activeActions} {onAction} {showKeyHints} />
    </div>
    <div class="flex items-center gap-3">
      <ActionCluster {activeActions} {onAction} {showKeyHints} {vizType} {autoSendOn} />
      <PlacementToggle current={placement} onChange={onPlacementChange} />
    </div>
  </div>
{/if}
```

**Step 6: Commit**

```bash
git add src/lib/components/controls/ && git commit -m "feat: add GamepadControls with nav cluster, zoom pair, action cluster, and 3 placement modes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Extend AppSettings for Control Placement

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/routes/settings/+page.svelte`

**Step 1: Add controlPlacement to AppSettings**

In `src/lib/types.ts`, add to the `AppSettings` interface:

```typescript
controlPlacement: 'hud' | 'dock' | 'embedded';
```

Update `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light',
  controlPlacement: 'hud'
};
```

**Step 2: Add control placement to settings page**

In `src/routes/settings/+page.svelte`, add a `controlPlacement` state variable initialized from the store, a select field in the form, and include it in the `save()` call.

```svelte
<div>
  <label for="placement" class="block text-sm font-medium text-gray-700 mb-1">Control Placement</label>
  <select
    id="placement"
    bind:value={controlPlacement}
    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="hud">Floating HUD</option>
    <option value="dock">Bottom Dock</option>
    <option value="embedded">Embedded in Editor</option>
  </select>
</div>
```

**Step 3: Commit**

```bash
git add src/lib/types.ts src/routes/settings/+page.svelte && git commit -m "feat: add control placement setting to AppSettings and settings page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Update ConceptDetails for Focus-Aware Display

**Files:**
- Modify: `src/lib/components/editor/ConceptDetails.svelte`

**Step 1: Add focus-aware rendering**

Update `ConceptDetails.svelte` to accept `focusedNodeId` and `zoomLevel` props. When a node is focused, highlight its concept tag and show only its relationships. When zoomed out past a threshold, show only top-level summary.

```svelte
<script lang="ts">
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    focusedNodeId: string | null;
    zoomLevel: number;
  }

  let { visualization, focusedNodeId, zoomLevel }: Props = $props();

  // Find the focused node and its connections
  const focusedNode = $derived(
    visualization?.nodes.find(n => n.id === focusedNodeId) ?? null
  );

  const connectedNodeIds = $derived(() => {
    if (!visualization || !focusedNodeId) return new Set<string>();
    const ids = new Set<string>();
    for (const edge of visualization.edges) {
      if (edge.source === focusedNodeId) ids.add(edge.target);
      if (edge.target === focusedNodeId) ids.add(edge.source);
    }
    return ids;
  });

  const filteredRelationships = $derived(() => {
    if (!visualization) return [];
    if (!focusedNodeId) return visualization.metadata.relationships;
    // Show relationships mentioning the focused node's label
    const label = focusedNode?.label?.toLowerCase() ?? '';
    return visualization.metadata.relationships.filter(
      r => r.toLowerCase().includes(label)
    );
  });

  // At very low zoom, show minimal info
  const isOverview = $derived(zoomLevel < 0.6);
</script>

{#if visualization}
  <div class="border-b p-4 space-y-3" style="border-color: var(--glass-border)">
    <div>
      <h2 class="font-semibold text-sm" style="font-family: var(--font-main)">
        {focusedNode ? focusedNode.label : visualization.title}
      </h2>
      <p class="text-xs text-gray-500 mt-0.5">
        {focusedNode?.details ?? visualization.description}
      </p>
    </div>

    {#if !isOverview && visualization.metadata.concepts.length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Concepts</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each visualization.metadata.concepts as concept}
            {@const isFocused = focusedNode?.label === concept}
            {@const isConnected = !focusedNodeId || isFocused ||
              visualization.nodes.some(n => n.label === concept && connectedNodeIds().has(n.id))}
            <span
              class="inline-block px-2 py-0.5 text-xs rounded-full transition-opacity duration-200"
              style="
                background: {isFocused ? 'var(--accent)' : 'var(--accent-light)'};
                color: {isFocused ? 'white' : 'var(--accent-text)'};
                opacity: {isConnected ? 1 : 0.3};
              "
            >
              {concept}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if !isOverview && filteredRelationships().length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Relationships</h3>
        <ul class="space-y-0.5">
          {#each filteredRelationships() as rel}
            <li class="text-xs text-gray-600">{rel}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if isOverview}
      <p class="text-xs text-gray-400 italic">Zoom in to see details</p>
    {/if}
  </div>
{/if}
```

**Step 2: Commit**

```bash
git add src/lib/components/editor/ConceptDetails.svelte && git commit -m "feat: update ConceptDetails with focus-aware and zoom-aware display

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Wire Controls into Main Page

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/AppShell.svelte`
- Modify: `src/lib/components/editor/EditorPane.svelte`
- Modify: `src/lib/components/visualizer/VisualizerCanvas.svelte`

**Step 1: Update AppShell to support dock placement**

Modify `src/lib/components/AppShell.svelte` to accept an optional `dock` snippet that renders below the main pane:

Add to Props interface:
```typescript
dock?: Snippet;
```

In the template, after the `<main>` element, add a conditional dock area:

```svelte
<div class="flex flex-col flex-1 min-w-0 overflow-hidden">
  <main class="flex-1 min-w-0 overflow-hidden relative">
    {@render main()}
  </main>
  {#if dock}
    {@render dock()}
  {/if}
</div>
```

Wrap the existing `<main>` and new dock in a flex-col container.

**Step 2: Update VisualizerCanvas to expose SVG element and support node click**

Add an `onNodeClick` callback prop and a `svgElement` bindable to `VisualizerCanvas.svelte`. When a node is clicked in the D3 rendering, call `onNodeClick(nodeId)`.

**Step 3: Wire everything together in +page.svelte**

Update `src/routes/+page.svelte` to:

1. Import `GamepadControls`, `focusStore`, `createKeyboardController`
2. Set up the keyboard controller in `onMount`, with `isTextInputFocused` checking if a textarea is focused
3. Route `PadAction` events to the appropriate store methods and handlers:
   - `zoom_in` / `zoom_out` -> `focusStore.zoomIn()` / `focusStore.zoomOut()`
   - `focus_up` / `focus_down` -> `focusStore.focusPrev()` / `focusStore.focusNext()`
   - `focus_left` / `focus_right` -> `focusStore.focusPrev()` / `focusStore.focusNext()`
   - `fit_to_screen` -> `focusStore.fitToScreen()`
   - `visualize` -> `handleVisualize()`
   - `cycle_viz_type` -> cycle through types array and call `vizStore.setVizType()`
   - `export` -> toggle export menu
   - `toggle_auto_send` -> toggle auto-send
   - `deselect` -> `focusStore.clear()`
   - `pan_*` -> programmatic D3 pan via svg transform
4. Set `data-viz-type` and `data-theme` attributes on `<body>` reactively
5. When viz type changes via `cycle_viz_type`, re-render the visualization with the new type
6. Pass `focusedNodeId` and `zoomLevel` to `ConceptDetails` via `EditorPane`
7. When a visualization loads, call `focusStore.setNodeIds(viz.nodes.map(n => n.id))`
8. Render `GamepadControls` in the appropriate slot based on placement setting:
   - `hud`: inside the `main` snippet (absolute positioned over canvas)
   - `dock`: in the `dock` snippet of AppShell
   - `embedded`: in the `editor` snippet, between ConceptDetails and TextEditor

**Step 4: Update EditorPane to pass focus props through**

Add `focusedNodeId` and `zoomLevel` props to `EditorPane`, pass them to `ConceptDetails`.

**Step 5: Remove old Visualize button and auto-send toggle from TextEditor**

Since these are now handled by the gamepad controls, remove the button row from `TextEditor.svelte`. Keep the textarea and the Cmd+Enter keyboard shortcut (which now routes through the keyboard controller).

**Step 6: Verify in browser**

Run: `npm run dev -- --port 5173`
Expected:
- Gamepad controls appear floating over the canvas (HUD mode by default)
- Pressing Z/X zooms, W/A/S/D navigates nodes, Enter triggers visualize
- Pad buttons light up on key press
- Switching placement via the toggle moves controls
- Concept details update when a node is focused
- Accent colors change when viz type cycles

**Step 7: Commit**

```bash
git add src/ && git commit -m "feat: wire gamepad controls, keyboard controller, and focus system into main app

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Apply Adaptive Theming to Existing Components

**Files:**
- Modify: `src/lib/components/AppShell.svelte`
- Modify: `src/lib/components/files/FileItem.svelte`
- Modify: `src/lib/components/files/FileList.svelte`
- Modify: `src/lib/components/export/ExportMenu.svelte`
- Modify: `src/routes/settings/+page.svelte`

**Step 1: Replace hardcoded blue with CSS custom properties**

Across all components, replace:
- `bg-blue-600` / `bg-blue-50` / `text-blue-800` -> inline styles using `var(--accent)`, `var(--accent-light)`, `var(--accent-text)`
- `focus:ring-blue-500` -> `focus:ring-[var(--accent)]` or inline style
- Hardcoded `#3b82f6` references in non-D3 code -> `var(--accent)`

Apply `font-family: var(--font-main)` globally via the body rule already in `app.css`.

**Step 2: Update AppShell for dark mode support**

Add conditional dark mode classes based on `data-theme="dark"` attribute:
- Background: `bg-gray-50` -> `[data-theme="dark"] &: bg-gray-950`
- Text: `text-gray-900` -> `[data-theme="dark"] &: text-gray-100`
- Borders: adjust for dark mode

Since Tailwind CSS 4, use `@custom-variant dark (&:where([data-theme="dark"] *))` in `app.css` for dark variant support, or use inline styles with CSS variables.

**Step 3: Verify theming works**

Toggle theme to dark in settings. Expected: all surfaces, text, and accents update. Switch viz types. Expected: accent colors shift across controls and concept tags.

**Step 4: Commit**

```bash
git add src/ && git commit -m "feat: apply adaptive accent theming and dark mode across all components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Final Integration Test

**Files:**
- No new files

**Step 1: Run all existing tests**

Run: `npx vitest run`
Expected: All tests pass (existing 17 + new focus store tests + keyboard controller tests).

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Manual browser verification checklist**

Run: `npm run dev -- --port 5173`

Verify:
- [ ] Space Grotesk font renders everywhere
- [ ] Gamepad controls visible in HUD mode (bottom corners)
- [ ] Press Z/X -> zoom buttons light up on pad
- [ ] Press W/A/S/D -> nav buttons light up, node focus changes
- [ ] Press Enter -> visualize triggers (when text present)
- [ ] Press Tab -> viz type cycles, accent color changes
- [ ] Press P -> export menu opens
- [ ] Press Q -> auto-send toggles
- [ ] Press Space -> fit to screen
- [ ] Arrow keys pan the canvas
- [ ] Switch placement to Dock -> controls move to bottom bar
- [ ] Switch placement to Embedded -> controls appear in editor pane
- [ ] Click a node -> concept details update to show that node
- [ ] Zoom out far -> concept details collapse to summary
- [ ] Dark mode -> all surfaces and glass effects invert
- [ ] Key hints appear on hover over pad buttons

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: integration fixes for gamepad UI

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task Dependency Graph

```
Task 1 (Font + CSS vars)
  |
  +-- Task 2 (Focus store + viz type tracking)
  |     |
  |     +-- Task 3 (Keyboard controller)
  |     |     |
  |     |     +-- Task 5 (GamepadControls component) <-- also depends on Task 4
  |     |
  |     +-- Task 7 (Focus-aware ConceptDetails)
  |
  +-- Task 4 (PadButton + icons)
  |     |
  |     +-- Task 5 (GamepadControls component)
  |
  +-- Task 6 (AppSettings controlPlacement)

Task 8 (Wire into main page) <-- depends on Tasks 5, 6, 7
  |
  +-- Task 9 (Adaptive theming across components)
       |
       +-- Task 10 (Final integration test)
```

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Space Grotesk font + adaptive CSS custom properties | -- |
| 2 | Focus store + viz type tracking in viz store | 1 |
| 3 | Keyboard controller with key-to-action mapping | 2 |
| 4 | PadButton component + SVG icons | 1 |
| 5 | GamepadControls (NavCluster, ZoomPair, ActionCluster, 3 modes) | 3, 4 |
| 6 | Add controlPlacement to AppSettings | 1 |
| 7 | Focus-aware ConceptDetails | 2 |
| 8 | Wire controls into main page | 5, 6, 7 |
| 9 | Adaptive theming across all components | 8 |
| 10 | Final integration test | 9 |
