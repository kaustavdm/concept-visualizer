# 3D Layers, Files & Scene Composition — Design

## Goal

Evolve the 3D experiment from a single hardcoded scene to a user-composable, persisted, layered scene system. Four capabilities:

1. **Decoupled scene rendering** — entities described as serializable data, not code
2. **Layers panel** — composable scene layers with text, voice, JSON, and visibility toggling
3. **File3d persistence** — scenes saved to IndexedDB via Dexie (separate from 2D files)
4. **Hex file browser** — floating hexagonal control for opening/creating files

## Architecture: Layer Store + Compositor

```
File3d (IndexedDB)
  └── layers: Layer3d[]
        ├── Layer 1: { text, json, visible, entities[] }
        ├── Layer 2: { text, json, visible, entities[] }
        └── ...
              │
              ▼
     Scene Compositor (reactive)
        - Filters visible layers, sorts by order
        - Prefixes entity IDs with layer ID
        - Resolves AnimationDSL → callbacks
        - Resolves themeResponse → onThemeChange
              │
              ▼
     SceneController.loadContent(composited SceneContent)
```

Engine (`createScene.ts`) stays untouched. The compositor is the only new seam between data and engine.

## 1. Animation DSL

Replaces callback functions with serializable configs. Covers the existing solar scene and common 3D patterns.

### Primitives

```typescript
type AnimationDSL =
  | { type: 'orbit'; center?: string; radius: number; speed: number;
      tilt?: number; bob?: { amplitude: number; speed: number } }
  | { type: 'rotate'; axis: 'x' | 'y' | 'z'; speed: number }
  | { type: 'bob'; amplitude: number; speed: number; axis?: 'y' }
  | { type: 'path'; points: [number,number,number][]; speed: number; loop: boolean }
  | AnimationDSL[]   // compose multiple animations
```

### Resolution

`resolveAnimation(dsl: AnimationDSL): (entity, ctx) => void` converts DSL to the callback the engine expects. Array DSL runs all animations sequentially on the entity each frame.

## 2. Revised SceneEntitySpec

```typescript
interface SceneEntitySpec {
  id: string;
  mesh: 'sphere' | 'box' | 'plane' | 'cone' | 'cylinder'
      | { type: 'cone'; baseRadius: number; peakRadius: number;
          height: number; capSegments?: number; heightSegments?: number };
  material: MaterialSpec;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  opacity?: { map: 'grid'; tiling: number; blend: true };
  animate?: AnimationDSL;
  followable?: boolean;
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };
}
```

Key change: `themeResponse` moves theme-based material overrides from a scene-level callback to per-entity config.

## 3. Layer3d Type

```typescript
interface Layer3d {
  id: string;
  name: string;
  visible: boolean;
  text: string;                 // Natural language description
  audioBlob?: Blob;             // Voice recording (optional)
  entities: SceneEntitySpec[];  // Structured data (JSON-editable)
  order: number;                // Stack position
  createdAt: Date;
  updatedAt: Date;
}
```

## 4. Layers Panel UI

Floating glass panel on the right side of the canvas.

```
┌──────────────────────────────┐
│  Layers                   [+]│
├──────────────────────────────┤
│ 👁 Layer 1: "Ground plane"   │   eye icon toggles visibility
│   ▸ 1 entity                 │   collapsed by default
├──────────────────────────────┤
│ 👁 Layer 2: "Orbiting objects"│
│   ▾ 3 entities               │   expanded shows:
│   ┊  JSON editor             │     editable structured JSON
│   ┊  [Generate] [Record 🎙]  │     LLM gen + voice buttons
├──────────────────────────────┤
│ ○  Layer 3: "Effects"        │   hollow circle = hidden
│   ▸ 2 entities               │
└──────────────────────────────┘
```

### Interactions

- Eye icon click → toggle `visible`, compositor re-renders immediately
- Layer name click → expand/collapse to show text + JSON + controls
- [Generate] → sends `text` to LLM → receives `SceneEntitySpec[]` → populates `entities`
- [Record 🎙] → Web Speech API → transcribes to `text` field
- [+] → creates new empty layer

## 5. File3d Type & Persistence

```typescript
interface File3d {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  layers: Layer3d[];
  camera?: {
    mode: CameraMode;
    position: [number, number, number];
    target?: string;
  };
  theme: 'light' | 'dark';
  metadata?: Record<string, unknown>;
}
```

### Database

New Dexie table (version 3), separate from 2D files:

```typescript
this.version(3).stores({
  files: 'id, title, updatedAt',       // existing 2D
  settings: 'id',                       // existing
  files3d: 'id, title, updatedAt'       // NEW
});
```

### Store

`files3dStore.ts`: writable store for current `File3d`, derived list of all files. CRUD operations with debounced auto-save (~2s).

## 6. Hex File Browser

`FileBrowserHex.svelte` — top-left floating hexagon.

**Three states:**

1. **Collapsed** — single hexagon showing current file title
2. **Fan-out** — click hex → 3-5 recent files radiate as circular nodes + "more..." + "+ New"
3. **Full panel** — click "more..." → glass panel with scrollable file list and search

Reuses fan-out animation pattern from HexagonDial.

## 7. Voice Input

`VoiceInput.svelte` — mic button using Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`).

- Press to start recording, press again to stop
- Continuous mode with interim results shown live
- Final transcript written to layer's `text` field
- Optional: store raw audio blob on the layer

## 8. Integration Map

### New files

| File | Purpose |
|------|---------|
| `src/lib/3d/animation-dsl.ts` | AnimationDSL types + resolveAnimation() |
| `src/lib/3d/compositor.ts` | composeLayers(layers) → SceneContent |
| `src/lib/3d/types.ts` | Layer3d, File3d types |
| `src/lib/stores/files3dStore.ts` | File3d CRUD + current file state |
| `src/lib/components/3d/LayersPanel.svelte` | Right-side floating layers UI |
| `src/lib/components/3d/FileBrowserHex.svelte` | Top-left hex file browser |
| `src/lib/components/3d/VoiceInput.svelte` | Web Speech API mic button |

### Modified files

| File | Change |
|------|--------|
| `src/lib/3d/scene-content.types.ts` | Add AnimationDSL, themeResponse to SceneEntitySpec |
| `src/lib/3d/scenes/solar.ts` | Rewrite as Layer3d[] using DSL (starter content) |
| `src/lib/db/index.ts` | Add files3d table (version 3) |
| `src/routes/3d/+page.svelte` | Wire FileBrowserHex, LayersPanel, compositor |

### Unchanged

- `src/lib/3d/createScene.ts` — engine API unchanged
- `src/lib/components/3d/MovementDial.svelte` — untouched
- `src/lib/components/3d/HexagonDial.svelte` — untouched
- `src/lib/components/3d/KeyboardHelp.svelte` — untouched
- All 2D visualization code — completely separate

## 9. Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│                      3D Page                                 │
│                                                              │
│  ┌──────────────┐                    ┌──────────────────┐   │
│  │FileBrowserHex│                    │  LayersPanel     │   │
│  │  (top-left)  │                    │  (right side)    │   │
│  └──────────────┘                    └──────────────────┘   │
│                                                              │
│                    ┌────────────────┐                        │
│                    │   <canvas>     │                        │
│                    │   PlayCanvas   │                        │
│                    └────────────────┘                        │
│                                                              │
│  ┌──────────────┐                    ┌──────────────────┐   │
│  │ MovementDial │                    │  HexagonDial     │   │
│  │ (bot-left)   │                    │  (bot-right)     │   │
│  └──────────────┘                    └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Design Decisions

1. **Separate Dexie table** — File3d has fundamentally different shape from ConceptFile. No migration risk.
2. **Entity ID namespacing** — compositor prefixes `layerId:entityId` to avoid cross-layer collisions.
3. **Animation DSL, not eval** — serializable, safe, covers common cases. Extensible with new primitives.
4. **Per-entity themeResponse** — more granular than per-scene callback. Each entity controls its own theme behavior.
5. **Compositor as pure function** — engine stays dumb, all composition logic is testable in isolation.
6. **Voice via Web Speech API** — browser-native, no external dependencies. Graceful degradation if unsupported.
