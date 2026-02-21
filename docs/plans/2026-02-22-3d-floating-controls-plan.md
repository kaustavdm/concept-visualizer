# 3D Floating Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete floating control system for the 3D view — SceneDial with radial fan-out, compass center on MovementDial, fullscreen/visibility keyboard shortcuts.

**Architecture:** Four components modified/created. SceneController gets compass angle + look-at-origin APIs. MovementDial center becomes a live compass. New SceneDial component provides 6 scene control faces with radial fan-out. Page wires everything with F/H keyboard shortcuts.

**Tech Stack:** Svelte 5 (runes), PlayCanvas (3D engine), SVG (control geometry), CSS custom properties (theming)

---

### Task 1: SceneController API — lookAtOrigin, getCompassAngle, setCameraMode

**Files:**
- Modify: `src/lib/3d/createScene.ts`

**Step 1: Add new methods to SceneController interface**

Add to the `SceneController` interface:
```typescript
export interface SceneController {
  setTheme(theme: 'light' | 'dark'): void;
  toggleCameraMode(): CameraMode;
  setCameraMode(mode: CameraMode): void;   // NEW: direct set for SceneDial
  getCameraMode(): CameraMode;
  setInput(action: string, active: boolean): void;
  lookAtOrigin(): void;                     // NEW: smooth rotation to face 0,0,0
  getCompassAngle(): number;                // NEW: angle for compass needle
  destroy(): void;
}
```

**Step 2: Add smooth look-at-origin state and logic**

Add state variables after `prevEffectiveMode`:
```typescript
let lookAtActive = false;
let lookAtT = 0;
const lookAtStartRot = new pc.Quat();
const lookAtEndRot = new pc.Quat();
```

Add `startLookAt` function:
```typescript
function startLookAt() {
  lookAtActive = true;
  lookAtT = 0;
  lookAtStartRot.copy(camera.getRotation());
  // Temporarily point camera at origin to capture target rotation
  const savedRot = camera.getRotation().clone();
  camera.lookAt(pc.Vec3.ZERO);
  lookAtEndRot.copy(camera.getRotation());
  camera.setRotation(savedRot);
}
```

In the update loop, add before the orbit/fly update block:
```typescript
// Smooth look-at-origin animation
if (lookAtActive) {
  lookAtT = Math.min(1, lookAtT + dt * 2.5);
  const t = 1 - Math.pow(1 - lookAtT, 3); // ease-out cubic
  const q = new pc.Quat();
  q.slerp(lookAtStartRot, lookAtEndRot, t);
  camera.setRotation(q);
  if (lookAtT >= 1) {
    lookAtActive = false;
    syncOrbitFromCamera();
  }
}
```

**Step 3: Add compass angle computation**

```typescript
function computeCompassAngle(): number {
  const pos = camera.getPosition();
  const toOrigin = new pc.Vec3(-pos.x, -pos.y, -pos.z);
  toOrigin.normalize();
  const screenX = toOrigin.dot(camera.right);
  const screenY = toOrigin.dot(camera.up);
  return Math.atan2(screenX, screenY) * (180 / Math.PI);
}
```

**Step 4: Add setCameraMode and expose new methods in return object**

```typescript
setCameraMode(mode: CameraMode) {
  cameraMode = mode;
  prevEffectiveMode = mode;
  if (mode === 'orbit') {
    syncOrbitFromCamera();
  }
},
lookAtOrigin() { startLookAt(); },
getCompassAngle() { return computeCompassAngle(); },
```

**Step 5: Verify and commit**

Run: `npm run check`
Expected: No new errors in createScene.ts

```bash
git add src/lib/3d/createScene.ts
git commit -m "feat(3d): add lookAtOrigin, getCompassAngle, setCameraMode to SceneController"
```

---

### Task 2: MovementDial Compass Center

**Files:**
- Modify: `src/lib/components/3d/MovementDial.svelte`

**Step 1: Update Props interface**

Replace existing Props:
```typescript
interface Props {
  compassAngle: number;
  onInputStart: (action: string) => void;
  onInputEnd: (action: string) => void;
  onLookAtOrigin: () => void;
}
```

Remove `cameraMode`, `onToggleMode` props. Remove `MODE_ICONS` constant.

**Step 2: Replace center button with compass needle**

Replace the center mode toggle `<circle>` and mode icon `<svg>` (lines 151-188) with:
```svelte
<!-- Center compass -->
<circle
  cx="80" cy="80" r="22"
  fill="var(--pad-btn-bg)"
  stroke="var(--glass-border)"
  stroke-width="1"
  style="cursor: pointer;"
  onclick={onLookAtOrigin}
/>
<!-- Compass needle (rotates to point toward origin) -->
<g transform="rotate({compassAngle}, 80, 80)" pointer-events="none">
  <polygon points="80,60 76,80 84,80" fill="var(--accent)" opacity="0.9" />
  <polygon points="80,100 76,80 84,80" fill="var(--text-muted)" opacity="0.3" />
</g>
<circle cx="80" cy="80" r="3" fill="var(--accent)" pointer-events="none" />
{#if showKeyHints}
  <text
    x="80" y="109" text-anchor="middle"
    fill="var(--text-muted)" font-size="9"
    font-family="var(--font-main)" font-weight="500"
    pointer-events="none" opacity="0.7"
  >C</text>
{/if}
```

**Step 3: Verify visually**

Dev server should show the MovementDial with a rotating compass needle in the center.

```bash
git add src/lib/components/3d/MovementDial.svelte
git commit -m "feat(3d): replace MovementDial center with live compass needle"
```

---

### Task 3: SceneDial Component

**Files:**
- Create: `src/lib/components/3d/SceneDial.svelte`

This is the largest task. The SceneDial is a single SVG component with:
- Flat-top hexagon outline (R=72, center at 80,80 in a 160x160 viewBox)
- 6 trapezoidal face paths between inner circle (r=26) and hex edges
- Center circle showing last-interacted face icon
- Radial fan-out of options when a face is tapped

**Step 1: Define hex geometry constants**

ViewBox: 0 0 160 160. Center: (80, 80). Hex R=72. Inner circle r=26.

Hex vertices (flat-top, clockwise from right):
```
v0 (0°):   (152, 80)
v1 (60°):  (116, 142.4)
v2 (120°): (44, 142.4)
v3 (180°): (8, 80)
v4 (240°): (44, 17.6)
v5 (300°): (116, 17.6)
```

Inner circle points:
```
i0 (0°):   (106, 80)
i1 (60°):  (93, 102.5)
i2 (120°): (67, 102.5)
i3 (180°): (54, 80)
i4 (240°): (67, 57.5)
i5 (300°): (93, 57.5)
```

6 face paths (each: inner→hexVertex1→hexVertex2→inner→arc):
```
Top:         M67,57.5 L44,17.6 L116,17.6 L93,57.5 A26,26 0 0,0 67,57.5
Upper-right: M93,57.5 L116,17.6 L152,80 L106,80 A26,26 0 0,0 93,57.5
Lower-right: M106,80 L152,80 L116,142.4 L93,102.5 A26,26 0 0,0 106,80
Bottom:      M93,102.5 L116,142.4 L44,142.4 L67,102.5 A26,26 0 0,0 93,102.5
Lower-left:  M67,102.5 L44,142.4 L8,80 L54,80 A26,26 0 0,0 67,102.5
Upper-left:  M54,80 L8,80 L44,17.6 L67,57.5 A26,26 0 0,0 54,80
```

Icon center positions (approximate centroid of each face):
```
Top:         (80, 38)
Upper-right: (118, 56)
Lower-right: (118, 104)
Bottom:      (80, 122)
Lower-left:  (42, 104)
Upper-left:  (42, 56)
```

Fan-out outward angles (direction from center through face midpoint):
```
Top: 270°, Upper-right: 330°, Lower-right: 30°
Bottom: 90°, Lower-left: 150°, Upper-left: 210°
```

Edge midpoints (where fan-out originates):
```
Top: (80, 17.6), Upper-right: (134, 48.8), Lower-right: (134, 111.2)
Bottom: (80, 142.4), Lower-left: (26, 111.2), Upper-left: (26, 48.8)
```

**Step 2: Define face configuration data**

Each face has: id, label, SVG path, icon (24x24 path), icon position, fan angle, options array, isToggle flag.

Faces (clockwise from top):
1. `theme` — direct toggle (light/dark), no fan-out
2. `lighting` — fan-out: studio, dramatic, soft, ambient
3. `environment` — fan-out: void, gradient, grid
4. `objects` — fan-out: (placeholder options for now)
5. `camera` — fan-out: orbit, fly, follow
6. `effects` — fan-out: (placeholder options for now)

**Step 3: Build the component**

Props:
```typescript
interface Props {
  selections: Record<string, string>;
  onSelect: (faceId: string, optionId: string) => void;
  onToggle: (faceId: string) => void;
}
```

State:
```typescript
let openFace: string | null = $state(null);
let lastInteracted: string = $state('theme');
let idle = $state(true);
// ... idle timer logic same as MovementDial
```

SVG structure:
1. Glass hex backdrop (via CSS div with clip-path: polygon matching hex vertices)
2. SVG layer with face paths, center circle, icons
3. Fan-out options (conditionally rendered when a face is open)

Fan-out option positioning:
- For face with N options and outward angle θ, edge midpoint (mx, my)
- Each option i at position:
  - angle = θ + (i - (N-1)/2) * 25° (25° spread between options)
  - distance = 44px from edge midpoint
  - x = mx + distance * cos(angle_rad)
  - y = my + distance * sin(angle_rad)
  - (using SVG convention where 0°=right, 90°=down)

Fan-out animation: each option gets `transition-delay: i * 50ms` with CSS transform from scale(0) to scale(1).

Click-outside to close: `<svelte:window onclick>` handler checks if click target is outside the dial.

**Step 4: Verify visually**

The hex dial should render on the right side, faces should highlight on hover, tapping a face shows fan-out options, theme face toggles directly.

```bash
git add src/lib/components/3d/SceneDial.svelte
git commit -m "feat(3d): add SceneDial component with radial fan-out"
```

---

### Task 4: Page Wiring — F/H Keys, Remove Theme Toggle, Add SceneDial

**Files:**
- Modify: `src/routes/3d/+page.svelte`

**Step 1: Add state for control visibility and fullscreen**

```typescript
let controlsVisible = $state(true);
let compassAngle = $state(0);
let dialSelections = $state<Record<string, string>>({
  theme: 'light',
  lighting: 'studio',
  environment: 'void',
  objects: 'all',
  camera: 'orbit',
  effects: 'none',
});
```

**Step 2: Add compass angle polling**

In an animation frame loop or $effect, poll `scene.getCompassAngle()`:
```typescript
$effect(() => {
  if (!scene) return;
  let raf: number;
  function tick() {
    compassAngle = scene!.getCompassAngle();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
});
```

**Step 3: Add F and H key handlers**

In `handleKeyDown`, add:
```typescript
if (e.key.toLowerCase() === 'f') {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
  return;
}
if (e.key.toLowerCase() === 'h') {
  controlsVisible = !controlsVisible;
  return;
}
```

**Step 4: Handle dial selections**

```typescript
function handleDialSelect(faceId: string, optionId: string) {
  dialSelections = { ...dialSelections, [faceId]: optionId };
  if (faceId === 'camera') {
    scene?.setCameraMode(optionId as CameraMode);
    cameraMode = optionId as CameraMode;
  }
}

function handleDialToggle(faceId: string) {
  if (faceId === 'theme') {
    toggleTheme();
    dialSelections = { ...dialSelections, theme: theme === 'light' ? 'dark' : 'light' };
  }
}
```

**Step 5: Update template**

- Remove the theme toggle button (lines 109-123)
- Wrap MovementDial and SceneDial in a visibility container:
  ```svelte
  {#if controlsVisible}
    <div class="transition-opacity duration-200" style="opacity: 1;">
      <MovementDial ... />
      <SceneDial ... />
    </div>
  {/if}
  ```
- Update MovementDial props (compassAngle, onLookAtOrigin instead of cameraMode, onToggleMode)
- Add SceneDial positioned `right-6 top-1/2 -translate-y-1/2`
- Update camera mode badge to read from `dialSelections.camera`

**Step 6: Verify and commit**

- F key toggles fullscreen
- H key hides/shows all controls
- Theme toggle works via hex dial top face
- Camera mode changes via hex dial camera face
- Compass needle tracks origin

```bash
git add src/routes/3d/+page.svelte
git commit -m "feat(3d): wire SceneDial, compass, F/H shortcuts into 3D page"
```

---

### Task 5: Final Integration Check

**Step 1:** Run `npm run check` — no new type errors
**Step 2:** Visual verification checklist:
- [ ] MovementDial compass needle rotates as camera moves
- [ ] Clicking compass smoothly rotates camera to face origin
- [ ] SceneDial renders on right side, vertically centered
- [ ] Tapping hex face shows radial fan-out options
- [ ] Selecting an option closes fan-out and updates state
- [ ] Theme face toggles light/dark directly
- [ ] Camera face selection changes camera mode
- [ ] F key toggles fullscreen
- [ ] H key hides/shows all controls
- [ ] Both controls fade to 40% after 3s idle
- [ ] Camera mode badge reflects current mode

**Step 3:** Commit all remaining changes

```bash
git add -A
git commit -m "feat(3d): complete floating controls system with hex dial and compass"
```
