# DSL Redesign: PlayCanvas-Aligned Entity Model, Observation Modes, Chat Pipeline

## Summary

Redesign the 3D layer JSON DSL to align with PlayCanvas's entity-component architecture, add a prefab system for observation mode renderers, integrate the extraction pipeline via chat-driven input, and prepare the data model for eventual CRDT-based multiplayer.

## Design Decisions

1. **Prefab templates + overrides** — entities reference named templates, customized per-instance
2. **PlayCanvas-aligned component bag** — `components: { render, light, ... }` mirrors PlayCanvas API
3. **Two-stage pipeline** — shared extractor produces `VisualizationSchema`, mode-specific renderer maps to `Layer3d[]`
4. **Entity hierarchy** — `children` array for parent-child nesting, matching PlayCanvas scene graph
5. **Typed subset + passthrough** (Approach C) — type essential+common PlayCanvas properties, allow arbitrary properties via index signature

## 1. Entity Spec

The `SerializableEntitySpec` is replaced by `EntitySpec`, a PlayCanvas-aligned entity with typed component subsets.

### Component Specs

```typescript
interface RenderComponentSpec {
  type: 'sphere' | 'box' | 'plane' | 'cone' | 'cylinder' | 'torus' | 'capsule';
  castShadows?: boolean;
  receiveShadows?: boolean;
  geometry?: {
    type: 'cone';
    capSegments: number;
    baseRadius: number;
    peakRadius: number;
    height: number;
    heightSegments: number;
  };
  [key: string]: unknown;  // PlayCanvas passthrough
}

interface LightComponentSpec {
  type: 'directional' | 'omni' | 'spot';
  color?: [number, number, number];
  intensity?: number;
  range?: number;
  castShadows?: boolean;
  shadowResolution?: number;
  innerConeAngle?: number;
  outerConeAngle?: number;
  [key: string]: unknown;
}

interface MaterialSpec {
  diffuse?: [number, number, number];
  emissive?: [number, number, number];
  specular?: [number, number, number];
  metalness?: number;
  gloss?: number;
  opacity?: number;
  blendType?: 'normal' | 'additive' | 'none';
  [key: string]: unknown;
}
```

### Entity

```typescript
interface EntitySpec {
  id: string;

  // Transform (mirrors pc.Entity)
  position?: [number, number, number];
  rotation?: [number, number, number];  // Euler degrees
  scale?: [number, number, number];

  // PlayCanvas components
  components: {
    render?: RenderComponentSpec;
    light?: LightComponentSpec;
  };

  // Material (convenience — applies to render component)
  material?: MaterialSpec;

  // Hierarchy
  children?: EntitySpec[];

  // Project extensions
  prefab?: string;
  animate?: AnimationDSL;
  tags?: string[];
  followable?: boolean;
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };

  // Semantic metadata (from VisualizationSchema mapping)
  label?: string;
  weight?: number;
  details?: string;
}
```

### Key design notes

- `material` stays at entity level (not inside `render`) — convenience for the common case, matches how materials are built in `createScene.ts`
- `components.render` replaces old `mesh` field — uses PlayCanvas's `type` values directly
- `tags` replaces `narrativeRole`/`logicalRole`/`storyRole` — roles become tags like `['central']`, `['premise']`
- `[key: string]: unknown` on component specs allows any PlayCanvas property without casting
- `label`, `weight`, `details` are project-specific semantic fields for tooltip/interaction

## 2. Animation DSL Fixes

### Bug fixes

| # | Bug | Fix |
|---|-----|-----|
| 1 | `resolveBob` destroys entity position — `setPosition(0, y, 0)` wipes X/Z | Read entity's current X/Z, only modify bob axis additively |
| 2 | `resolveRotate` ignores initial rotation — absolute angle from zero | Capture initial rotation on first frame, add animation delta |
| 3 | `BobAnimation.axis` field vestigial — only `'y'` works | Support `'x' \| 'y' \| 'z'` properly, or remove field |
| 4 | Orbit `center` requires undocumented namespaced ID | Compositor resolves bare IDs at composition time |
| 5 | Array composition overwrites — two position-setting animations conflict | Document last-writer-wins per transform channel |

### New animation types

```typescript
interface ScaleAnimation {
  type: 'scale';
  from: [number, number, number];
  to: [number, number, number];
  speed: number;         // cycles per second
  easing?: 'linear' | 'sine';
}

interface LookAtAnimation {
  type: 'lookAt';
  target: string;        // entity ID — auto-resolved like orbit center
}
```

`scale` enables pulsing/breathing effects for concept nodes. `lookAt` enables entities that always face a target (labels, billboards).

No changes to `orbit` and `path` (they work correctly). `rotate` gets the initial-rotation fix. `bob` gets the position-preservation fix.

## 3. Layer & Scene Model (CRDT-Aware)

### Layer3d

```typescript
interface Layer3d {
  id: string;                        // UUID
  name: string;
  visible: boolean;

  entities: EntitySpec[];
  text: string;                      // Source concept text

  position: string;                  // Fractional index for CRDT-safe ordering
  source: LayerSource;               // What created this layer
  createdAt: string;                 // ISO 8601
  updatedAt: string;

  observationMode?: string;          // Which renderer produced this layer
}

type LayerSource =
  | { type: 'chat'; messageId: string }
  | { type: 'manual' }
  | { type: 'import'; format: string }
  | { type: 'clone'; sourceLayerId: string };
```

### Scene3d (replaces File3d)

```typescript
interface Scene3d {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;

  layers: Layer3d[];

  environment?: {
    ambientColor?: [number, number, number];
    clearColor?: [number, number, number];
    fog?: { type: 'none' | 'linear' | 'exp' | 'exp2'; color?: [number, number, number]; density?: number };
  };

  camera?: {
    mode: 'orbit' | 'fly' | 'follow';
    position: [number, number, number];
    target?: string;
  };

  version: number;
  messages?: ChatMessage[];

  metadata?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  layerIds: string[];
  observationMode?: string;
}
```

### Changes from current File3d

| Field | Current | New | Why |
|-------|---------|-----|-----|
| `layers[].order` | integer | fractional index string (`position`) | Concurrent inserts between same neighbors don't conflict |
| `layers[].createdAt` | `Date` | ISO string | Serializable, no structured-clone issues |
| `layers[].audioBlob` | `Blob` | removed | Not serializable, not CRDT-mergeable |
| `File3d.theme` | `'light' \| 'dark'` (dead) | `environment.clearColor` + `ambientColor` | Actually functional, PlayCanvas-aligned |
| `File3d.camera` | dead field | `camera` (same shape) | Wired to createScene on load |
| — | — | `messages[]` | Chat history that produced the scene |
| — | — | `version` | Monotonic counter for change tracking |
| — | — | `layers[].source` | Provenance: what created each layer |
| — | — | `layers[].observationMode` | Which renderer produced the layer |

### CRDT preparation

The model supports future CRDT wrapping without schema changes:

- **Layer insert**: fractional index between neighbors — no ordering conflicts
- **Layer update**: per-field Last-Writer-Wins on `name`, `visible`, `position`
- **Entity mutations**: addressed by `layerId + entityId` — fine-grained operations
- **Scene version**: causal clock for single-user; becomes vector clock in multiplayer

## 4. Prefab System

Prefabs are templates resolved at layer-creation time, not a runtime system.

```typescript
interface PrefabDefinition {
  id: string;
  description: string;
  template: Omit<EntitySpec, 'id'>;
  slots: string[];  // Fields the renderer is expected to override
}
```

### Resolution

When an entity has `prefab: 'concept-node'`:
1. Look up `PrefabDefinition` by id
2. Deep-merge `template` with entity fields (entity wins)
3. Strip `prefab` from resolved entity

Merge rules: arrays replace (not concatenate), objects merge recursively, primitives override.

### Starter prefabs

| Prefab ID | Mesh | Purpose |
|-----------|------|---------|
| `concept-node` | sphere | Default concept representation |
| `concept-pillar` | cylinder + child box cap | Elevated/important concepts |
| `concept-gem` | cone (capSegments: 6) | Crystalline/refined concepts |
| `relationship-beam` | box (elongated) | Edge between two concepts |
| `ground-plane` | plane | Grid floor |
| `ambient-light` | — (light only) | Scene mood lighting |
| `label-billboard` | — (element) | Floating text label |

### Properties

- Prefabs are data (JSON in a registry), not code
- Observation modes can define mode-specific prefabs
- LLMs receive the prefab catalog as prompt context
- Prefabs don't reference other prefabs (no nesting)

## 5. Observation Modes (3D Renderers)

Observation modes take a `VisualizationSchema` and produce `Layer3d[]`. Each mode has its own visual language.

```typescript
interface ObservationMode {
  id: string;
  name: string;
  description: string;
  prefabs?: PrefabDefinition[];
  render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
  systemPromptOverride?: string;
}

interface RenderOptions {
  theme: 'light' | 'dark';
  existingLayers?: Layer3d[];
  messageId?: string;
}

interface ObservationModeRegistry {
  getMode(id: string): ObservationMode | undefined;
  listModes(): ObservationMode[];
  register(mode: ObservationMode): void;
}
```

### Mode renderer responsibilities

1. **Layout**: 3D spatial arrangement of nodes from the schema
2. **Prefab selection**: Map `narrativeRole`, `weight` to prefab templates
3. **Material mapping**: `theme` cluster labels to color palettes
4. **Edge representation**: `relationship-beam` entities positioned between nodes
5. **Ambient layer**: Ground plane + mood lighting
6. **Output**: Typically 3 layers — ground, concepts, connections

### Starter modes

| Mode | Spatial metaphor | Visual identity |
|------|-----------------|-----------------|
| `graph` | Force-directed 3D layout | Neutral — spheres, beams, white light |
| `morality` | Vertical moral spectrum | Gold/purple palette, warm amber light |
| `epistemology` | Concentric rings of certainty | Glass/transparent materials, cool blue light |
| `storyboard` | Linear timeline path | Sequential Z-axis positions, spotlight follow |

### Properties

- Not extractors — consume `VisualizationSchema`, don't call the LLM
- Not exclusive — multiple modes can render simultaneously as separate layer groups
- Not interactive at runtime — animation comes from `animate` DSL

## 6. LayersPanel Changes

### New visual elements per layer

| Element | Purpose |
|---------|---------|
| Observation mode badge | Colored pill showing which renderer produced this layer |
| Source icon | Chat bubble / pencil / copy — from `layer.source.type` |
| Message preview | Truncated source text (~40 chars of `layer.text`) |

Layer header row becomes: `[eye] [mode-badge] [name] [source-icon] [x]`

### Behavioral changes

- **Sorting**: `position.localeCompare(b.position)` replaces numeric sort
- **Expanded detail**: read-only text for chat-sourced layers; entity tree view (collapsible) for hierarchical entities
- **Generate button**: becomes `[Mode: morality v] [Generate]` — mode selector + generate
- **Layer grouping**: layers from same `source.messageId` share visual grouping
- **Drag-to-reorder**: updates fractional index

### New Props

```typescript
interface Props {
  layers: Layer3d[];
  observationModes: { id: string; name: string }[];
  activeObservationMode: string;
  onToggleVisibility: (layerId: string) => void;
  onUpdateText: (layerId: string, text: string) => void;
  onUpdateEntities: (layerId: string, entities: EntitySpec[]) => void;
  onAddLayer: () => void;
  onRemoveLayer: (layerId: string) => void;
  onReorderLayer: (layerId: string, newPosition: string) => void;
  onGenerate?: (layerId: string, text: string, observationMode: string) => void;
  onSelectObservationMode?: (modeId: string) => void;
}
```

## 7. Compositor Changes

### New flow

```
Layer3d[] → filter visible → sort by position (fractional index)
  → for each entity:
      → resolve prefab (deep-merge template with overrides)
      → namespace IDs (recursive: layer:entity, layer:entity/child)
      → resolve bare entity refs in animations (same-layer first, then cross-layer)
      → resolve animations (recursive for children)
      → collect themeResponse entries (recursive for children)
  → flatten hierarchy: children get parent? field in SceneEntitySpec
  → build SceneContent
```

### ID namespacing with hierarchy

```
Layer "concepts", entity "justice", child "scale"
→ "concepts:justice"
→ "concepts:justice/scale"
```

`:` separates layer from entity, `/` separates parent from child.

### Animation reference resolution

Bare IDs in `orbit.center`, `lookAt.target` are resolved by the compositor:
1. Same layer: `currentLayerId:bareId`
2. Other layers: `otherLayerId:bareId` (first match)
3. Already namespaced (contains `:`): keep as-is

### SceneEntitySpec gains `parent` field

```typescript
interface SceneEntitySpec {
  // ... existing fields ...
  parent?: string;  // Namespaced ID of parent entity (undefined = root)
}
```

`composeLayers` remains a pure function. Output is still `SceneContent`.

## 8. createScene / Builder Changes

### `buildEntity` rewrite

Reads `spec.components`, iterates component types:

```typescript
function buildEntity(app, spec): pc.Entity {
  const entity = new pc.Entity(spec.id);
  if (spec.position) entity.setPosition(...spec.position);
  if (spec.rotation) entity.setLocalEulerAngles(...spec.rotation);
  if (spec.scale) entity.setLocalScale(...spec.scale);

  if (spec.components?.render) addRenderComponent(app, entity, spec.components.render, spec.material);
  if (spec.components?.light) addLightComponent(entity, spec.components.light);

  return entity;
}
```

### `loadContent` — two-pass for hierarchy

1. First pass: create all entities, store in `activeEntities`
2. Second pass: wire `parent` references via `addChild()`, or add to `app.root`

Two-pass needed because a child may appear before its parent in the flat array.

### `buildMaterial` additions

- `opacity` → `mat.opacity`, auto-enables `mat.blendType = pc.BLEND_NORMAL`
- `blendType` → mapped via `{ normal: pc.BLEND_NORMAL, additive: pc.BLEND_ADDITIVE, none: pc.BLEND_NONE }`
- Index-signature passthrough: iterate remaining keys, set directly on `pc.StandardMaterial`

### Grid floor becomes a prefab

`buildGridFloor` special case removed. Grid texture generation moves to a utility. The `ground-plane` prefab template handles the setup.

### Hardcoded camera reference fix

```diff
- const sphereEntity = activeEntities['sphere'];
- const bobY = sphereEntity ? sphereEntity.getPosition().y * 0.5 : 0;
- camera.lookAt(new pc.Vec3(0, bobY, 0));
+ camera.lookAt(pc.Vec3.ZERO);
```

### Camera and environment restore on scene load

`Scene3d.camera` and `Scene3d.environment` are read during `loadContent` and applied to the PlayCanvas app/camera, making these fields functional (currently dead code).

## 9. Pipeline Integration (Chat to Layers)

### Flow

```
Chat input (CodeMirror) → submit message
  → store ChatMessage in Scene3d.messages[]
  → pipeline.run(text, null, engineId) → VisualizationSchema
  → modeRegistry.getMode(activeMode).render(schema, options) → Layer3d[]
  → tag layers with source: { type: 'chat', messageId }
  → append to Scene3d.layers[]
  → compositor → createScene renders
```

### Additive rendering

Each chat message appends new layers. The mode renderer receives `existingLayers` to:
- Avoid position collisions
- Create cross-layer connections (edges to existing concepts)
- Maintain consistent color assignments across messages

### Re-rendering

Switching observation mode on existing layers: re-extract from stored `layer.text` (or use cached schema), run through new mode renderer, replace layers with matching `source.messageId`.

## 10. Chat Input UI

### Placement

- Absolute bottom-center, above status bar (28px), between the two dials
- ~500px wide, max 60vw
- Single line default, expands to ~120px on focus/multiline
- Glass card styling matching existing UI

### Behavior

- CodeMirror 6 with minimal extensions
- Enter to submit, Shift+Enter for newline
- Observation mode badge to the left
- Submit button (arrow icon) to the right
- Auto-activates input mode on focus
- Inline pipeline stage progress (analyzing → extracting → rendering)

### Scope

- Not a chat history viewer — messages shown via layer provenance in LayersPanel
- Not a REPL — submits to extraction pipeline
- Per-scene message history

## 11. Migration

### IndexedDB (Dexie version 4)

Migration function for existing `files3d` records:

| Field | Transformation |
|-------|---------------|
| `layer.order` (int) | → `layer.position` (fractional index from order) |
| `layer.createdAt/updatedAt` (Date) | → ISO strings |
| `layer.entities[].mesh` | → `{ components: { render: { type: mesh } } }` |
| `layer.entities[].material` | stays at entity level |
| `layer.audioBlob` | dropped |
| all layers | add `source: { type: 'manual' }` |
| `file.theme` | → `file.environment.clearColor` + `ambientColor` |
| file | add `version: 1`, `messages: []` |

### Code migration

- Solar scene (`solar.ts`): rewrite to new entity shape — test case for migration correctness
- Compositor tests: update all fixtures to component-bag entities
- Clean break — no backward compatibility layer needed

## 12. Complete Bug Fix List

| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | `resolveBob` destroys position (sets X/Z to 0) | `animation-dsl.ts:71-73` | Read current X/Z, only modify bob axis |
| 2 | `resolveRotate` ignores initial rotation | `animation-dsl.ts:59-66` | Capture initial on first frame, add delta |
| 3 | `BobAnimation.axis` vestigial (only 'y') | `animation-dsl.ts:35` | Support `'x' \| 'y' \| 'z'` or remove |
| 4 | Orbit `center` needs undocumented namespace | `animation-dsl.ts:85-93` | Compositor resolves bare IDs |
| 5 | `File3d.camera` dead code | `createScene.ts` | Wire camera restore on load |
| 6 | `File3d.theme` dead code | `createScene.ts` | Replace with `environment`, wire on load |
| 7 | Orbit camera hardcodes `'sphere'` entity | `createScene.ts:450-452` | Look at origin |
| 8 | `opacity` spec over-specialized | `scene-content.types.ts:41` | Replace with `material.opacity` + `blendType` |
| 9 | `parser.ts` VALID_TYPES missing types | `parser.ts:3` | Add `logicalflow`, `storyboard` |
| 10 | Array animation overwrite undocumented | `animation-dsl.ts:187-196` | Document last-writer-wins |
