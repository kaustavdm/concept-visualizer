# 3D Floating Controls UX Design

## Overview

A floating control system for the 3D visualization view (`/3d`). All UI is glassmorphic overlays on a full-screen PlayCanvas canvas. The design language uses four geometric primitives: circles, triangles, hexagons, and rectangles.

## Layout

```
┌──────────────────────────────────────────────────────┐
│ [Orbit]                                              │
│                                                      │
│                                                      │
│                     3D SCENE                         │
│                                                      │
│                                          ⬡ Hex Dial  │
│  ◯ CameraPad                             (6 faces)  │
│  ⬡⬡ zoom                                            │
└──────────────────────────────────────────────────────┘
```

- **Bottom-left**: CameraPad — circular d-pad with compass center + hex zoom buttons
- **Right, vertically centered**: HexDial — circle-in-hexagon with 6 scene control faces
- **Top-left**: Camera mode badge (reads from HexDial Camera face selection)
- Top-right theme toggle: removed (theme moves into HexDial)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| WASD | Camera movement (continuous hold) |
| ZX | Zoom in/out |
| Shift+WASD | Temporary camera mode switch |
| F | Toggle browser fullscreen |
| H | Toggle all floating control visibility |

## CameraPad (Bottom-Left)

Existing circular d-pad with triangular directional buttons and hexagonal zoom pair.

### Compass Center

The center button becomes a live compass pointing toward 0,0,0:

- A directional needle inside the center circle rotates in real-time based on the camera's position relative to the scene origin
- **Click**: smoothly rotates camera to face 0,0,0 from current position (~500ms ease-out lerp, no position change)
- Camera mode toggle (orbit/fly) moves to the HexDial's Camera face

## HexDial (Right Side)

A circle inscribed in a flat-top hexagon. The 6 trapezoidal regions between the inner circle and hex edges are tappable control faces.

### Faces (Clockwise from Top)

1. **Theme** — light/dark (direct toggle, no fan-out)
2. **Lighting** — studio, dramatic, soft, ambient (4 presets)
3. **Environment** — void, gradient, grid (3 backgrounds)
4. **Objects** — visibility toggles for scene elements
5. **Camera** — orbit, fly, follow (3 modes)
6. **Effects** — bloom, depth-of-field, etc.

### Center Circle

Shows the icon of the last-interacted face. Provides at-a-glance context for which control group was last used.

### Radial Fan-Out

When a hex face is tapped (except simple toggles like Theme):

- Options appear as small circles (~32px) in a curved arc from the tapped face's outer edge
- Arc spans ~60-90 degrees, centered on the face's outward normal direction
- Staggered animation: 50ms delay per option, ~150ms total
- Selected option has accent fill + glow; others use `var(--pad-btn-bg)`
- Tapping an option selects it and closes the fan
- Tapping elsewhere closes the fan
- Only one fan open at a time

### Fan Direction by Face

- Top face: fans upward
- Top-right: fans upper-right
- Bottom-right: fans lower-right
- Bottom: fans downward
- Bottom-left: fans lower-left
- Top-left: fans upper-left

## Visual Design

### Geometric Language

- **Circles**: buttons, center indicators, fan-out options, compass
- **Triangles**: directional navigation (CameraPad)
- **Hexagons**: zoom buttons, dial body, structural frames
- **Rectangles**: reserved for future floating panels (text, content lists)

### Glass Surfaces

All floating controls use:
- `background: var(--glass-bg)`
- `backdrop-filter: blur(16px)`
- `border: 1px solid var(--glass-border)`

### Idle Behavior

Both CameraPad and HexDial fade to 40% opacity after 3s of no interaction. Mouse movement or interaction restores full opacity.

### Control Visibility (H Key)

H toggles all floating controls. Fade out/in with 200ms transition. The canvas and scene remain fully interactive when controls are hidden.

## Scene Controller Additions

- `lookAtOrigin()` — smooth lerp to face 0,0,0 from current position
- `getCompassAngle()` — returns the angle from camera to origin projected onto screen plane, for compass needle rotation

## Out of Scope

- Actual lighting preset implementations (UI only, selection state tracked)
- Actual environment/effects rendering (UI only)
- Follow camera mode logic
- Object visibility beyond the sphere

Controls emit selections. Scene implementations will be wired progressively during story visualization development.

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| HexDial.svelte | src/lib/components/3d/ | The 6-face hex dial with center circle and fan-out |
| CameraPad.svelte | src/lib/components/3d/ | Updated: compass center replacing mode toggle |
| createScene.ts | src/lib/3d/ | Updated: lookAtOrigin(), getCompassAngle() |
| +page.svelte | src/routes/3d/ | Updated: F/H keys, remove theme toggle, add HexDial |
