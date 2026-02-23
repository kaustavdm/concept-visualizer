# 3D Entity DSL Reference

The entity DSL defines 3D scenes as composable layers of entities. It aligns with PlayCanvas's entity-component model while remaining JSON-serializable for persistence and LLM generation.

## Architecture

```
Scene3d
  └── Layer3d[]          ← ordered by fractional index
        └── EntitySpec[]  ← nested via children
              ├── components: { render?, light?, text? }
              ├── material
              ├── animate (AnimationDSL)
              └── children: EntitySpec[]
```

**Compositor** (`composeLayers()`) merges visible layers into a single `SceneContent` that the PlayCanvas engine renders. Entity IDs are namespaced as `${layerId}:${entityId}` to prevent collisions across layers.

## EntitySpec

The core building block. Each entity maps to a PlayCanvas `pc.Entity`.

```typescript
interface EntitySpec {
  id: string;
  position?: [number, number, number];   // world coordinates
  rotation?: [number, number, number];   // euler angles in degrees
  scale?: [number, number, number];      // uniform or per-axis

  components: {
    render?: RenderComponentSpec;
    light?: LightComponentSpec;
    text?: TextComponentSpec;
  };

  material?: MaterialSpec;
  children?: EntitySpec[];               // nested hierarchy
  prefab?: string;                       // template name to resolve
  animate?: AnimationDSL;                // declarative animation
  tags?: string[];                       // semantic grouping
  followable?: boolean;                  // camera can follow this entity

  // Theme-responsive material overrides
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };

  // Metadata (used by observation modes)
  label?: string;
  weight?: number;                       // 0-1 importance
  details?: string;                      // description text
}
```

### Render Component

Maps to PlayCanvas `pc.RenderComponent`. Common properties are typed; additional PlayCanvas properties pass through via index signature.

```typescript
interface RenderComponentSpec {
  type: 'sphere' | 'box' | 'plane' | 'cone' | 'cylinder' | 'torus' | 'capsule';
  castShadows?: boolean;
  receiveShadows?: boolean;
  geometry?: {                           // custom geometry (e.g., pyramid)
    type: 'cone';
    capSegments: number;
    baseRadius: number;
    peakRadius: number;
    height: number;
    heightSegments: number;
  };
  [key: string]: unknown;               // passthrough for advanced properties
}
```

### Light Component

Maps to PlayCanvas `pc.LightComponent`.

```typescript
interface LightComponentSpec {
  type: 'directional' | 'omni' | 'spot';
  color?: [number, number, number];
  intensity?: number;
  range?: number;
  castShadows?: boolean;
  shadowResolution?: number;
  innerConeAngle?: number;               // spot lights only
  outerConeAngle?: number;               // spot lights only
  [key: string]: unknown;
}
```

### Text Component

Canvas-to-texture text rendering. Entities with only a `text` component (no `render`) become billboard planes. Entities with both `render` and `text` get text applied as an emissive texture overlay.

```typescript
interface TextComponentSpec {
  text: string;
  fontSize?: number;                     // default 24px
  color?: [number, number, number];      // 0-1 RGB
  background?: [number, number, number]; // optional background fill
  backgroundOpacity?: number;
  align?: 'center' | 'left' | 'right';
  billboard?: boolean;                   // face camera each frame
  maxWidth?: number;                     // word-wrap width in pixels
}
```

Text canvases are power-of-2 sized for WebGL compatibility. Word wrapping handles explicit `\n` newlines and splits on whitespace.

### Material

Maps to PlayCanvas `pc.StandardMaterial`. Colors are `[r, g, b]` tuples (0-1 range for scene definitions, 0-255 for observation mode output — the compositor auto-normalizes).

```typescript
interface MaterialSpec {
  diffuse?: [number, number, number];
  emissive?: [number, number, number];
  specular?: [number, number, number];
  metalness?: number;                    // 0-1
  gloss?: number;                        // 0-1
  opacity?: number;                      // 0-1
  blendType?: 'normal' | 'additive' | 'none';
  [key: string]: unknown;
}
```

## Animation DSL

Declarative animation primitives that get resolved to per-frame callbacks by the compositor. Animations compose via arrays.

### Primitives

| Type | Key Properties | Description |
|------|---------------|-------------|
| `orbit` | `radius`, `speed`, `center?`, `tilt?`, `bob?` | Circular orbit around a point or entity |
| `rotate` | `axis` (`x`/`y`/`z`), `speed` (rev/s) | Continuous rotation preserving initial rotation |
| `bob` | `amplitude`, `speed` | Y-axis oscillation preserving X/Z position |
| `scale` | `min`, `max`, `speed` | Uniform pulsing scale |
| `lookat` | `target` (entity ID) | Face another entity each frame |
| `path` | `points`, `speed`, `loop` | Linear interpolation along waypoints |

### Composition

Combine multiple animations by wrapping them in an array. Each runs on the entity every frame:

```typescript
const animate: AnimationDSL = [
  { type: 'orbit', radius: 8, speed: 0.3, bob: { amplitude: 0.25, speed: 0.8 } },
  { type: 'rotate', axis: 'y', speed: 0.033 }
];
```

### Cross-Entity References

Animation targets (orbit center, lookat target) reference entities by ID. The compositor resolves bare IDs to namespaced IDs:

- Same-layer first: `'sphere'` → `'orbiting:sphere'`
- Cross-layer fallback: searches all layers
- Already-namespaced IDs pass through: `'orbiting:sphere'` stays as-is

### Units

- **orbit.speed**: radians per second
- **orbit.tilt**: radians (not degrees)
- **rotate.speed**: revolutions per second
- **path.speed**: world units per second

## Layer3d

A layer groups entities for visibility toggling and ordering. Layers are the unit of composition.

```typescript
interface Layer3d {
  id: string;                            // UUID
  name: string;                          // display name
  visible: boolean;                      // toggleable in LayersPanel
  entities: EntitySpec[];
  text: string;                          // source text (from chat input)
  position: string;                      // fractional index for ordering
  source: LayerSource;                   // provenance tracking
  createdAt: string;                     // ISO 8601
  updatedAt: string;
  observationMode?: string;              // which mode generated this layer
}
```

### Layer Ordering (Fractional Index)

Layers are ordered by `position` — a lexicographic string that supports insertions without reindexing. The utility at `src/lib/utils/fractional-index.ts` provides:

- `generatePosition()` → `'n'` (midpoint)
- `insertBetween(lower, upper)` → string that sorts between them
- `positionsForCount(n)` → evenly-spaced positions for initial ordering

Convention: `'a'` = bottom (ground), `'n'` = middle, `'z'` = top (foreground).

### Layer Source

Tracks how a layer was created:

```typescript
type LayerSource =
  | { type: 'chat'; messageId: string }    // generated from chat message
  | { type: 'manual' }                     // user-created
  | { type: 'import'; format: string }     // imported from file
  | { type: 'clone'; sourceLayerId: string } // cloned from another layer
```

## Scene3d

Top-level container persisted in IndexedDB via Dexie.js.

```typescript
interface Scene3d {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  layers: Layer3d[];
  version: number;                       // schema version
  messages?: ChatMessage[];              // chat history
  snapshots?: VersionSnapshot[];         // undo/restore points

  environment?: {
    ambientColor?: [number, number, number];
    clearColor?: [number, number, number];
    fog?: { type: 'none' | 'linear' | 'exp' | 'exp2'; color?: [...]; density?: number };
  };
  camera?: {
    mode: 'orbit' | 'fly' | 'follow';
    position: [number, number, number];
    target?: string;                     // entity ID to follow
  };
  metadata?: Record<string, unknown>;
}
```

### ChatMessage

Each chat submission is stored with its results and the cached extraction schema.

```typescript
interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;                     // ISO 8601
  layerIds: string[];                    // layers produced by this message
  observationMode?: string;              // mode active when sent
  schema?: VisualizationSchema;          // cached extraction result
}
```

### VersionSnapshot

Point-in-time scene state for undo/restore. Tier-granular: each pipeline tier can produce a snapshot.

```typescript
interface VersionSnapshot {
  version: number;
  timestamp: string;
  layers: Layer3d[];
  description: string;
  tier?: number;                         // which pipeline tier produced this
  messageId?: string;                    // originating chat message
}
```

## Prefab System

Named entity templates resolved at composition time. Prefabs define defaults that entity overrides can selectively replace.

```typescript
interface PrefabDefinition {
  id: string;
  description: string;
  template: Omit<EntitySpec, 'id'>;      // default properties
  slots: string[];                       // customizable fields (documentation only)
}
```

Usage in an entity:

```typescript
const entity: EntitySpec = {
  id: 'my-sphere',
  prefab: 'morality:agent',              // resolved from registry
  material: { diffuse: [1, 0, 0] },      // overrides prefab default
};
```

Resolution: `resolvePrefab(entity, registry)` deep-merges the prefab template under the entity's own properties. Entity fields always win. Arrays replace (not concatenate). Children pass through from the entity, not the template. The `prefab` key is stripped from the result.

Each observation mode declares its own `prefabs: PrefabDefinition[]` which are registered in the prefab registry at mode activation time.

## Observation Modes

Observation modes are pluggable renderers that convert extracted concepts (`VisualizationSchema`) into `Layer3d[]` arrays. Each mode provides a different spatial metaphor, role vocabulary, and prefab set.

```typescript
interface ModeRole {
  id: string;
  label: string;
  description: string;
  prefab: string;                        // prefab ID for this role
  relevance: 'high' | 'medium' | 'low';
}

interface ObservationMode {
  id: string;
  name: string;
  description: string;
  roles: ModeRole[];                     // role vocabulary for LLM classification
  prefabs: PrefabDefinition[];           // mode-specific prefab templates
  storyFocus: string;                    // LLM prompt guidance for this mode
  render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
}
```

### Built-in Modes

| Mode | ID | Spatial Metaphor | Roles | Layers |
|------|----|-----------------|-------|--------|
| **Graph** | `graph` | Circle layout on XZ plane | core, supporting, peripheral, emergent | Ground, Concepts, Connections |
| **Morality** | `morality` | Tension-web with agents/affected on opposing sides | agent, affected, duty, value, consequence, tension | Environment, Concepts, Connections |
| **Ontology** | `ontology` | Y-stratified categories with instances and properties | category, instance, property, process | Environment, Concepts, Connections |
| **Epistemology** | `epistemology` | Concentric rings — certain at center, uncertain at periphery | claim, evidence, means, assumption, limit | Environment, Concepts, Connections |
| **Causality** | `causality` | Directed Z-flow from causes to effects | cause, effect, mechanism, purpose, condition | Environment, Concepts, Connections |
| **Debate** | `debate` | Opposing poles (left/right) with resolution at center | position, counter, resolution, tension, ground | Environment, Concepts, Connections |
| **Appearance** | `appearance` | Two-plane parallax — surface above, depth below | surface, depth, lens, veil, marker | Environment, Concepts, Connections |

Modes are registered in `ObservationModeRegistry` and selected via the hex dial's Observe face.

### Creating a New Mode

1. Create `src/lib/3d/observation-modes/<name>.ts`
2. Define roles, prefabs, storyFocus, and a `render()` function
3. Register in `+page.svelte`

```typescript
export const myMode: ObservationMode = {
  id: 'my-mode',
  name: 'My Mode',
  description: 'Custom visualization',
  roles: [
    { id: 'primary', label: 'Primary', description: '...', prefab: 'my-mode:primary', relevance: 'high' },
  ],
  prefabs: [{
    id: 'my-mode:primary',
    description: 'Primary concept node',
    template: {
      components: { render: { type: 'sphere' } },
      material: { diffuse: [0.5, 0.5, 0.8] },
    },
    slots: ['material', 'scale'],
  }],
  storyFocus: 'Classify each concept by...',
  render(schema, options) {
    const entities: EntitySpec[] = schema.nodes.map(node => ({
      id: node.id,
      prefab: `my-mode:${node.modeRole ?? 'primary'}`,
      components: {},
      position: [/* layout logic */],
      label: node.label,
      children: [{
        id: `${node.id}-label`,
        components: { text: { text: node.label, billboard: true } },
        position: [0, 1.2, 0],
      }],
    }));
    return [{
      id: crypto.randomUUID(),
      name: 'My Layer',
      visible: true,
      entities,
      text: '',
      position: 'n',
      source: { type: 'manual' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      observationMode: 'my-mode',
    }];
  },
};
```

## Pipeline

User text flows through a three-tier progressive extraction pipeline before being rendered by the active observation mode.

```
User text (ChatInput)
  → Tier 1: JS extraction (RAKE + NLP + TF-IDF)
    → VisualizationSchema (basic nodes + edges)
      → Observation mode .render() → Layer3d[] [yield]
  → Tier 2: TF.js refinement (USE embeddings + K-means clustering)
    → VisualizationSchema (enriched themes + weights)
      → Observation mode .render() → Layer3d[] [yield]
  → Tier 3: LLM micro-prompts (narrative roles, descriptions, story focus)
    → VisualizationSchema (full enrichment)
      → Observation mode .render() → Layer3d[] [yield]
        → composeLayers()
          → SceneContent { entities, onThemeChange }
            → PlayCanvas engine renders
```

### Tiered Runner

The pipeline is an `AsyncGenerator` that yields progressively enriched results. Each tier is optional and can be skipped via settings.

```typescript
interface TieredRunner {
  run(text: string, onStage?: (stage: PipelineStage) => void): AsyncGenerator<TierResult>;
  abort(): void;
}
```

The **PipelineBridge** connects the tiered runner to observation modes:

```typescript
interface TieredBridgeResult {
  tier: number;
  layers: Layer3d[];
  schema: VisualizationSchema;
}
```

### Pipeline Stages

Reported via `onStage` callback and displayed in the StatusBar:

| Stage | Description |
|-------|-------------|
| `tier1-extracting` | JS keyword/NLP extraction running |
| `tier1-complete` | Tier 1 results available |
| `tier2-embedding` | TF.js USE embedding + clustering |
| `tier2-complete` | Tier 2 results available |
| `tier3-enriching` | LLM micro-prompts running |
| `tier3-complete` | Tier 3 results available |
| `complete` | All tiers finished |

Each tier yields a `TierResult { tier: number, schema: VisualizationSchema }`. The bridge re-renders through the active observation mode at each tier, so the scene progressively enriches as tiers complete.

## Example: Solar Scene

A complete scene defined with the DSL (from `src/lib/3d/scenes/solar.ts`):

```typescript
// Pyramid with custom geometry
const pyramid: EntitySpec = {
  id: 'pyramid',
  components: {
    render: {
      type: 'cone',
      geometry: { type: 'cone', capSegments: 4, baseRadius: 1, peakRadius: 0, height: 2, heightSegments: 1 },
    },
  },
  material: { diffuse: [0.76, 0.7, 0.5], metalness: 0.1, gloss: 0.4 },
  position: [0, 0, 0],
  rotation: [0, 45, 0],
};

// Orbiting sphere with theme response
const sphere: EntitySpec = {
  id: 'sphere',
  components: { render: { type: 'sphere' } },
  material: { diffuse: [0.23, 0.51, 0.96], metalness: 0.3, gloss: 0.75 },
  scale: [1.5, 1.5, 1.5],
  followable: true,
  animate: [
    { type: 'orbit', radius: 8, speed: 0.3, bob: { amplitude: 0.25, speed: 0.8 } },
    { type: 'rotate', axis: 'y', speed: 0.033 },
  ],
  themeResponse: {
    light: { diffuse: [0.23, 0.51, 0.96] },
    dark: { diffuse: [0.25, 0.5, 1.0] },
  },
};

// Moon orbiting the sphere (cross-entity reference)
const moon: EntitySpec = {
  id: 'moon',
  components: { render: { type: 'sphere' } },
  material: { diffuse: [0.75, 0.75, 0.78], metalness: 0.6, gloss: 0.85 },
  scale: [0.15, 0.15, 0.15],
  followable: true,
  animate: { type: 'orbit', center: 'orbiting:sphere', radius: 1.875, speed: 0.6, tilt: Math.PI / 4 },
};
```

Three layers compose the scene: Ground (position `'a'`), Structures (position `'n'`), Orbiting Bodies (position `'z'`).

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/3d/entity-spec.ts` | EntitySpec, Layer3d, Scene3d, ChatMessage, VersionSnapshot types |
| `src/lib/3d/animation-dsl.ts` | Animation types and resolver |
| `src/lib/3d/compositor.ts` | `composeLayers()` — merges layers into SceneContent |
| `src/lib/3d/prefabs.ts` | Prefab registry and resolver |
| `src/lib/3d/text-renderer.ts` | Canvas-to-texture text rendering utility |
| `src/lib/3d/scene-content.types.ts` | Runtime types (SceneContent, SceneEntitySpec) |
| `src/lib/3d/createScene.ts` | PlayCanvas engine setup, entity building, billboard system |
| `src/lib/3d/observation-modes/` | ObservationMode interface, registry, and 7 built-in modes |
| `src/lib/3d/pipeline-bridge.ts` | Connects tiered extraction pipeline to observation modes |
| `src/lib/pipeline/runner.ts` | `createTieredRunner()` — AsyncGenerator pipeline orchestrator |
| `src/lib/pipeline/tiers/` | Tier implementations: tier1-extract, tier2-refine, tier3-enrich |
| `src/lib/pipeline/store.ts` | Pipeline stage store for StatusBar display |
| `src/lib/utils/fractional-index.ts` | CRDT-safe layer ordering |
