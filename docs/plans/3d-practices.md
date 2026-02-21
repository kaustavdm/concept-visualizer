# 3D Controls — Development Practices & Bug Journal

## Architecture

```
+page.svelte (src/routes/3d/)
├── createScene.ts (src/lib/3d/)         — PlayCanvas engine, camera, sphere, scene controller API
├── MovementDial.svelte (src/lib/components/3d/) — Bottom-left circular d-pad, compass needle, hex zoom
└── SceneDial.svelte (src/lib/components/3d/)    — Bottom-right hex dial, 6 faces, radial fan-out
```

### Data Flow

```
PlayCanvas update loop (60fps)
  └─ camera.setPosition(cx, cy, cz)  ← orbit/fly math updates camera each frame

+page.svelte onMount
  └─ rAF loop: compassAngle = s.getCompassAngle()  ← reads camera position, writes $state
       └─ passed as prop to MovementDial
            └─ SVG: <g transform="rotate({compassAngle}, 80, 80)">

Keyboard events (svelte:window onkeydown/onkeyup)
  └─ WASD/ZX → scene.setInput(action, true/false)  ← drives camera movement
  └─ WASD/ZX → keyActiveActions Set updated          ← passed to MovementDial for glow
  └─ O/;/./,/M/K → dialActivateFace                  ← passed to SceneDial for face activation
  └─ L → dialActivateCenter                          ← cycles open fan options
  └─ F → fullscreen toggle
  └─ H → controlsVisible toggle
```

### CSS Variable System

The 3D controls use dedicated CSS custom properties defined in `src/app.css`:

| Variable | Light | Dark | Used for |
|----------|-------|------|----------|
| `--glass-bg` | `rgba(255,255,255,0.65)` | `rgba(0,0,0,0.55)` | Glass backdrop fill |
| `--glass-border` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.25)` | Outline strokes |
| `--pad-btn-bg` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.18)` | Default button fill |
| `--pad-btn-bg-hover` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.3)` | Hovered button fill |
| `--pad-btn-bg-active` | `rgba(59,130,246,0.35)` | `rgba(59,130,246,0.4)` | Active/pressed button |
| `--pad-icon` | `#334155` | `#e2e8f0` | Icon fills, key hint text |
| `--pad-icon-muted` | `#64748b` | `#94a3b8` | Dimmer secondary icons |
| `--accent` | `#3b82f6` | `#3b82f6` | Active highlights, compass needle |

**Critical**: The `--pad-icon` and `--pad-icon-muted` variables were added to improve contrast against the 3D canvas background. Both dials should use these instead of `--text-muted` or `--text-tertiary` for icon fills, key hints, and secondary text.

---

## Resolved Bugs

### BUG 1–3: Compass, keyboard glow, and contrast — ALL FIXED

**Root cause**: The `settingsStore.subscribe()` callback was inside a `$effect` block. The callback read `dialSelections` (via spread `...dialSelections`) and wrote a new object to it. Since Svelte 5 `$effect` tracks all synchronous reads — including those inside callbacks invoked immediately by `subscribe()` — this created an infinite reactivity loop (`effect_update_depth_exceeded`). The broken reactivity system caused all three bugs.

**Fix**: Moved the `settingsStore.subscribe()` from `$effect` into `onMount`, which has no dependency tracking. The subscribe callback can safely read+write `$state` variables inside `onMount` without creating cycles.

**Lesson**: In Svelte 5, never read+write the same `$state` variable inside a `$effect` — even indirectly through callbacks that execute synchronously during effect setup (like store `subscribe()` which invokes the callback immediately with the current value).

---

## SceneController API Reference

```typescript
interface SceneController {
  setTheme(theme: 'light' | 'dark'): void;
  toggleCameraMode(): CameraMode;        // Returns new mode
  setCameraMode(mode: CameraMode): void;  // Direct set (from SceneDial)
  getCameraMode(): CameraMode;
  setInput(action: string, active: boolean): void;
  // Actions: pan_up, pan_down, pan_left, pan_right, zoom_in, zoom_out, shift
  lookAtOrigin(): void;     // Smooth ~400ms slerp to face 0,0,0
  getCompassAngle(): number; // Degrees, XZ bearing from camera to origin
  destroy(): void;
}
```

## Component Props Quick Reference

### MovementDial
```typescript
interface Props {
  compassAngle: number;               // Degrees for compass needle rotation
  onInputStart: (action: string) => void;
  onInputEnd: (action: string) => void;
  onLookAtOrigin: () => void;          // Center button click
  keyActiveActions?: Set<string>;      // Keyboard-driven glow state
}
```

### SceneDial
```typescript
interface Props {
  selections: Record<string, string>;  // Current selection per face id
  onSelect: (faceId: string, optionId: string) => void;
  onToggle: (faceId: string) => void;  // For toggle faces (theme)
  activateFace?: string | null;        // Keyboard-triggered face activation
  activateCenter?: boolean;            // L key: cycle option in open fan
}
```

### SceneDial Face IDs and Key Bindings
| Position | Face ID | Key | Type | Options |
|----------|---------|-----|------|---------|
| Top | `theme` | O | Toggle | (toggles light/dark) |
| Top-right | `lighting` | ; | Fan-out | studio, dramatic, soft, ambient |
| Bottom-right | `environment` | . | Fan-out | void, gradient, grid |
| Bottom | `objects` | , | Fan-out | all, primary, none |
| Bottom-left | `camera` | M | Fan-out | orbit, fly, follow |
| Top-left | `effects` | K | Fan-out | none, bloom, dof |
| Center | (last icon) | L | Cycle | Cycles through open fan options |

## Keyboard Shortcut Map

| Key | Component | Action |
|-----|-----------|--------|
| W/A/S/D | MovementDial | Camera pan (continuous hold) |
| Z/X | MovementDial | Zoom in/out (continuous hold) |
| C | MovementDial | Look at origin (smooth 300ms slerp) |
| Shift+WASD | MovementDial | Temporary camera mode switch |
| O/;/./,/M/K | SceneDial | Activate face |
| L | SceneDial | Cycle open fan option |
| F | Page | Toggle browser fullscreen |
| H | Page | Toggle all control visibility |

## Hex Geometry Constants (SceneDial)

ViewBox: `0 0 160 160`, Center: `(80, 80)`, Hex R=72, Inner circle r=26

Hex vertices (flat-top): `(152,80) (116,142.4) (44,142.4) (8,80) (44,17.6) (116,17.6)`

Fan-out: options at 25° spread intervals, 44px distance from face edge midpoint.

## Camera Modes

- **Orbit**: Spherical coordinates (yaw/pitch/dist) around origin. WASD rotates orbit, ZX zooms. Camera always looks at `(0, bobY*0.5, 0)`.
- **Fly**: Free movement. WASD moves along camera forward/right. ZX moves vertically. Camera direction unchanged.
- **Shift**: Temporarily activates the other mode. Releasing Shift syncs orbit params from current camera position to prevent snap-back.

## Out of Scope (UI only, no scene implementation yet)

- Lighting presets (studio/dramatic/soft/ambient) — selection tracked but no effect
- Environment backgrounds (void/gradient/grid) — selection tracked
- Object visibility — selection tracked
- Follow camera mode — selection tracked
- Effects (bloom/DoF) — selection tracked

Controls emit selections via `onSelect`/`onToggle`. Scene implementations to be wired during story visualization development.
