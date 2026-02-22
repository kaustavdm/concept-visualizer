# 3D Layers, Files & Scene Composition — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the 3D experiment from a hardcoded scene to user-composable, persisted, layered scenes with animation DSL, layer panel, File3d storage, and hexagonal file browser.

**Architecture:** Layer Store + Compositor pattern. Layers (arrays of serializable entity specs with animation DSL) live in a Svelte writable store. A pure compositor function merges visible layers into a `SceneContent` the engine already accepts. Files persist to a separate `files3d` Dexie table. UI adds a LayersPanel (right), FileBrowserHex (top-left), and VoiceInput component.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, PlayCanvas, Dexie.js (IndexedDB), Web Speech API, vitest + jsdom + fake-indexeddb

**Design doc:** `docs/plans/2026-02-22-3d-layers-files-design.md`

---

## Task 1: Animation DSL Types & Resolver

**Files:**
- Create: `src/lib/3d/animation-dsl.ts`
- Test: `src/lib/3d/animation-dsl.test.ts`

This is the foundation — all other tasks depend on serializable entity specs.

**Step 1: Write the failing test**

Create `src/lib/3d/animation-dsl.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { resolveAnimation } from './animation-dsl';
import type { AnimationDSL } from './animation-dsl';

describe('resolveAnimation', () => {
  // Helper: mock pc.Entity with setPosition, setLocalEulerAngles, getPosition
  function mockEntity(pos = { x: 0, y: 0, z: 0 }) {
    return {
      setPosition: vi.fn(),
      setLocalEulerAngles: vi.fn(),
      getPosition: vi.fn(() => ({ ...pos, clone: () => ({ ...pos }) })),
    };
  }

  it('resolves rotate DSL — spins entity around Y axis', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'y', speed: 90 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    fn(entity as any, { time: 1, dt: 0.016, entities: {} });
    expect(entity.setLocalEulerAngles).toHaveBeenCalledWith(0, 90, 0);
  });

  it('resolves bob DSL — oscillates on Y axis', () => {
    const dsl: AnimationDSL = { type: 'bob', amplitude: 2, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    fn(entity as any, { time: Math.PI / 2, dt: 0.016, entities: {} });
    // sin(PI/2) = 1, so Y = 2 * 1 = 2
    expect(entity.setPosition).toHaveBeenCalled();
    const call = entity.setPosition.mock.calls[0];
    expect(call[1]).toBeCloseTo(2, 1);
  });

  it('resolves orbit DSL — circular path around origin', () => {
    const dsl: AnimationDSL = { type: 'orbit', radius: 5, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    fn(entity as any, { time: 0, dt: 0.016, entities: {} });
    expect(entity.setPosition).toHaveBeenCalled();
    const [x, _y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(5, 1); // cos(0) * 5
    expect(z).toBeCloseTo(0, 1); // sin(0) * 5
  });

  it('resolves orbit DSL with center entity reference', () => {
    const dsl: AnimationDSL = { type: 'orbit', center: 'hub', radius: 3, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const hub = mockEntity({ x: 10, y: 0, z: 10 });
    fn(entity as any, { time: 0, dt: 0.016, entities: { hub: hub as any } });
    const [x, _y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(13, 1); // 10 + cos(0)*3
    expect(z).toBeCloseTo(10, 1); // 10 + sin(0)*3
  });

  it('resolves orbit DSL with bob sub-animation', () => {
    const dsl: AnimationDSL = {
      type: 'orbit', radius: 5, speed: 1,
      bob: { amplitude: 0.5, speed: 2 },
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    fn(entity as any, { time: Math.PI / 4, dt: 0.016, entities: {} });
    const [_x, y, _z] = entity.setPosition.mock.calls[0];
    // bob Y = sin(PI/4 * 2) * 0.5 = sin(PI/2) * 0.5 = 0.5
    expect(y).toBeCloseTo(0.5, 1);
  });

  it('resolves array DSL — runs all animations', () => {
    const dsl: AnimationDSL = [
      { type: 'bob', amplitude: 1, speed: 1 },
      { type: 'rotate', axis: 'y', speed: 45 },
    ];
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    fn(entity as any, { time: 1, dt: 0.016, entities: {} });
    expect(entity.setPosition).toHaveBeenCalled();
    expect(entity.setLocalEulerAngles).toHaveBeenCalled();
  });

  it('resolves path DSL — interpolates between waypoints', () => {
    const dsl: AnimationDSL = {
      type: 'path',
      points: [[0,0,0], [10,0,0], [10,0,10]],
      speed: 1,
      loop: true,
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    // At time 0, should be at first point
    fn(entity as any, { time: 0, dt: 0.016, entities: {} });
    expect(entity.setPosition).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/3d/animation-dsl.test.ts`
Expected: FAIL — module `./animation-dsl` has no export `resolveAnimation`

**Step 3: Write the implementation**

Create `src/lib/3d/animation-dsl.ts`:

```typescript
import type { AnimationContext } from './scene-content.types';
import type * as pc from 'playcanvas';

// --- Animation DSL types (serializable) ---

export interface OrbitAnimation {
  type: 'orbit';
  center?: string;       // entity ID to orbit around (default: origin)
  radius: number;
  speed: number;         // radians per second
  tilt?: number;         // degrees — orbital plane tilt from XZ
  bob?: { amplitude: number; speed: number };
}

export interface RotateAnimation {
  type: 'rotate';
  axis: 'x' | 'y' | 'z';
  speed: number;         // degrees per second
}

export interface BobAnimation {
  type: 'bob';
  amplitude: number;
  speed: number;         // oscillation frequency multiplier
  axis?: 'y';            // default Y
}

export interface PathAnimation {
  type: 'path';
  points: [number, number, number][];
  speed: number;         // units per second along path
  loop: boolean;
}

export type AnimationDSL =
  | OrbitAnimation
  | RotateAnimation
  | BobAnimation
  | PathAnimation
  | AnimationDSL[];

export type AnimateFn = (entity: pc.Entity, ctx: AnimationContext) => void;

// --- Resolver: DSL → callback ---

function resolveOrbit(dsl: OrbitAnimation): AnimateFn {
  const tiltRad = ((dsl.tilt ?? 0) * Math.PI) / 180;
  return (entity, ctx) => {
    let cx = 0, cy = 0, cz = 0;
    if (dsl.center && ctx.entities[dsl.center]) {
      const pos = ctx.entities[dsl.center].getPosition();
      cx = pos.x; cy = pos.y; cz = pos.z;
    }
    const angle = ctx.time * dsl.speed;
    const orbX = Math.cos(angle) * dsl.radius;
    const orbZ = Math.sin(angle) * dsl.radius;
    // Apply tilt: rotate the orbit plane
    const y = dsl.bob
      ? Math.sin(ctx.time * dsl.bob.speed) * dsl.bob.amplitude
      : 0;
    const tiltedY = y + orbZ * Math.sin(tiltRad);
    const tiltedZ = orbZ * Math.cos(tiltRad);
    entity.setPosition(cx + orbX, cy + tiltedY, cz + tiltedZ);
  };
}

function resolveRotate(dsl: RotateAnimation): AnimateFn {
  return (entity, ctx) => {
    const deg = ctx.time * dsl.speed;
    const x = dsl.axis === 'x' ? deg : 0;
    const y = dsl.axis === 'y' ? deg : 0;
    const z = dsl.axis === 'z' ? deg : 0;
    entity.setLocalEulerAngles(x, y, z);
  };
}

function resolveBob(dsl: BobAnimation): AnimateFn {
  return (entity, ctx) => {
    const pos = entity.getPosition();
    const y = Math.sin(ctx.time * dsl.speed) * dsl.amplitude;
    entity.setPosition(pos.x, y, pos.z);
  };
}

function resolvePath(dsl: PathAnimation): AnimateFn {
  // Pre-compute segment lengths
  const pts = dsl.points;
  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i-1][0];
    const dy = pts[i][1] - pts[i-1][1];
    const dz = pts[i][2] - pts[i-1][2];
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    segLengths.push(len);
    totalLength += len;
  }
  if (dsl.loop) {
    const dx = pts[0][0] - pts[pts.length-1][0];
    const dy = pts[0][1] - pts[pts.length-1][1];
    const dz = pts[0][2] - pts[pts.length-1][2];
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    segLengths.push(len);
    totalLength += len;
  }

  return (entity, ctx) => {
    if (totalLength === 0 || pts.length < 2) return;
    let dist = (ctx.time * dsl.speed) % totalLength;
    if (dist < 0) dist += totalLength;
    let acc = 0;
    for (let i = 0; i < segLengths.length; i++) {
      if (acc + segLengths[i] >= dist) {
        const t = (dist - acc) / segLengths[i];
        const from = pts[i % pts.length];
        const to = pts[(i + 1) % pts.length];
        entity.setPosition(
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t,
          from[2] + (to[2] - from[2]) * t,
        );
        return;
      }
      acc += segLengths[i];
    }
  };
}

export function resolveAnimation(dsl: AnimationDSL): AnimateFn {
  if (Array.isArray(dsl)) {
    const fns = dsl.map(d => resolveAnimation(d));
    return (entity, ctx) => {
      for (const fn of fns) fn(entity, ctx);
    };
  }
  switch (dsl.type) {
    case 'orbit': return resolveOrbit(dsl);
    case 'rotate': return resolveRotate(dsl);
    case 'bob': return resolveBob(dsl);
    case 'path': return resolvePath(dsl);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/3d/animation-dsl.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/3d/animation-dsl.ts src/lib/3d/animation-dsl.test.ts
git commit -m "feat(3d): add animation DSL types and resolver

Declarative animation primitives (orbit, rotate, bob, path) that
compile to the callback functions the engine expects. Supports
composition via arrays and entity references for orbiting."
```

---

## Task 2: 3D Types — Layer3d, File3d, Updated SceneEntitySpec

**Files:**
- Create: `src/lib/3d/types.ts`
- Modify: `src/lib/3d/scene-content.types.ts` (add `themeResponse`, keep `animate` callback for engine, add `animateDSL` field)

**Step 1: Write the types**

Create `src/lib/3d/types.ts`:

```typescript
import type { SceneEntitySpec } from './scene-content.types';
import type { AnimationDSL } from './animation-dsl';
import type { CameraMode } from './createScene';

/** A serializable entity spec — uses AnimationDSL instead of callback */
export interface SerializableEntitySpec extends Omit<SceneEntitySpec, 'animate'> {
  animate?: AnimationDSL;
  themeResponse?: {
    light?: Partial<import('./scene-content.types').MaterialSpec>;
    dark?: Partial<import('./scene-content.types').MaterialSpec>;
  };
}

/** A composable layer of entities */
export interface Layer3d {
  id: string;
  name: string;
  visible: boolean;
  text: string;
  audioBlob?: Blob;
  entities: SerializableEntitySpec[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A persistable 3D scene file */
export interface File3d {
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

**Step 2: Add `themeResponse` to SceneEntitySpec**

In `src/lib/3d/scene-content.types.ts`, add after the `followable` field:

```typescript
  /** Per-entity theme-responsive material overrides (serializable alternative to scene-level onThemeChange) */
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };
```

**Step 3: Verify types compile**

Run: `npm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/3d/types.ts src/lib/3d/scene-content.types.ts
git commit -m "feat(3d): add Layer3d, File3d types and themeResponse on entity spec

SerializableEntitySpec uses AnimationDSL instead of callbacks.
Layer3d groups entities into toggleable layers. File3d wraps
layers with camera state and theme for IndexedDB persistence."
```

---

## Task 3: Scene Compositor

**Files:**
- Create: `src/lib/3d/compositor.ts`
- Test: `src/lib/3d/compositor.test.ts`

The compositor takes `Layer3d[]` → `SceneContent`. This is the key integration seam.

**Step 1: Write the failing test**

Create `src/lib/3d/compositor.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { composeLayers } from './compositor';
import type { Layer3d, SerializableEntitySpec } from './types';

function makeLayer(overrides: Partial<Layer3d> = {}): Layer3d {
  return {
    id: 'layer-1',
    name: 'Test Layer',
    visible: true,
    text: '',
    entities: [],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEntity(overrides: Partial<SerializableEntitySpec> = {}): SerializableEntitySpec {
  return {
    id: 'ent-1',
    mesh: 'sphere',
    material: { diffuse: [1, 0, 0] },
    ...overrides,
  };
}

describe('composeLayers', () => {
  it('returns empty SceneContent when no layers', () => {
    const result = composeLayers([], 'composed');
    expect(result.entities).toHaveLength(0);
    expect(result.id).toBe('composed');
  });

  it('filters out invisible layers', () => {
    const layers = [
      makeLayer({ id: 'a', visible: true, entities: [makeEntity({ id: 'e1' })] }),
      makeLayer({ id: 'b', visible: false, entities: [makeEntity({ id: 'e2' })] }),
    ];
    const result = composeLayers(layers, 'test');
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('a:e1');
  });

  it('prefixes entity IDs with layer ID', () => {
    const layers = [
      makeLayer({ id: 'L1', entities: [makeEntity({ id: 'box' })] }),
    ];
    const result = composeLayers(layers, 'test');
    expect(result.entities[0].id).toBe('L1:box');
  });

  it('sorts layers by order', () => {
    const layers = [
      makeLayer({ id: 'B', order: 2, entities: [makeEntity({ id: 'e' })] }),
      makeLayer({ id: 'A', order: 1, entities: [makeEntity({ id: 'e' })] }),
    ];
    const result = composeLayers(layers, 'test');
    expect(result.entities[0].id).toBe('A:e');
    expect(result.entities[1].id).toBe('B:e');
  });

  it('resolves AnimationDSL to animate callbacks', () => {
    const layers = [
      makeLayer({
        entities: [makeEntity({
          id: 'spinner',
          animate: { type: 'rotate', axis: 'y', speed: 90 },
        })],
      }),
    ];
    const result = composeLayers(layers, 'test');
    expect(typeof result.entities[0].animate).toBe('function');
  });

  it('generates onThemeChange from themeResponse fields', () => {
    const layers = [
      makeLayer({
        entities: [makeEntity({
          id: 'orb',
          themeResponse: {
            light: { diffuse: [1, 1, 1] },
            dark: { diffuse: [0, 0, 0] },
          },
        })],
      }),
    ];
    const result = composeLayers(layers, 'test');
    expect(typeof result.onThemeChange).toBe('function');
  });

  it('entities without animate DSL have no animate callback', () => {
    const layers = [
      makeLayer({ entities: [makeEntity({ id: 'static' })] }),
    ];
    const result = composeLayers(layers, 'test');
    expect(result.entities[0].animate).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/3d/compositor.test.ts`
Expected: FAIL — module `./compositor` not found

**Step 3: Write the implementation**

Create `src/lib/3d/compositor.ts`:

```typescript
import type { SceneContent, SceneEntitySpec, MaterialSpec } from './scene-content.types';
import type { Layer3d, SerializableEntitySpec } from './types';
import { resolveAnimation } from './animation-dsl';
import type * as pc from 'playcanvas';

/**
 * Compose visible layers into a single SceneContent the engine can load.
 *
 * - Filters to visible layers, sorts by order
 * - Prefixes entity IDs with layer ID to avoid collisions
 * - Resolves AnimationDSL → callback functions
 * - Collects themeResponse fields into a single onThemeChange callback
 */
export function composeLayers(layers: Layer3d[], id: string): SceneContent {
  const visible = layers
    .filter(l => l.visible)
    .sort((a, b) => a.order - b.order);

  const entities: SceneEntitySpec[] = [];
  const themeEntries: Array<{
    namespacedId: string;
    themeResponse: NonNullable<SerializableEntitySpec['themeResponse']>;
  }> = [];

  for (const layer of visible) {
    for (const spec of layer.entities) {
      const namespacedId = `${layer.id}:${spec.id}`;

      const engineSpec: SceneEntitySpec = {
        ...spec,
        id: namespacedId,
        animate: spec.animate ? resolveAnimation(spec.animate) : undefined,
      };

      // Remove themeResponse from the engine spec (it's not part of SceneEntitySpec used by engine)
      delete (engineSpec as any).themeResponse;

      entities.push(engineSpec);

      if (spec.themeResponse) {
        themeEntries.push({ namespacedId, themeResponse: spec.themeResponse });
      }
    }
  }

  const onThemeChange = themeEntries.length > 0
    ? (theme: 'light' | 'dark', entityMap: Record<string, pc.Entity>) => {
        for (const { namespacedId, themeResponse } of themeEntries) {
          const overrides = themeResponse[theme];
          if (!overrides) continue;
          const entity = entityMap[namespacedId];
          if (!entity?.render) continue;
          const mat = entity.render.meshInstances[0].material as pc.StandardMaterial;
          if (overrides.diffuse) mat.diffuse.set(...overrides.diffuse);
          if (overrides.emissive) mat.emissive.set(...overrides.emissive);
          if (overrides.specular) mat.specular.set(...overrides.specular);
          if (overrides.metalness !== undefined) mat.metalness = overrides.metalness;
          if (overrides.gloss !== undefined) mat.gloss = overrides.gloss;
          mat.update();
        }
      }
    : undefined;

  return {
    id,
    name: 'Composed Scene',
    entities,
    onThemeChange,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/3d/compositor.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/3d/compositor.ts src/lib/3d/compositor.test.ts
git commit -m "feat(3d): add scene compositor — merges visible layers into SceneContent

Pure function: filters visible layers, namespaces entity IDs,
resolves animation DSL, and collects themeResponse into a
single onThemeChange callback."
```

---

## Task 4: Convert Solar Scene to Layers

**Files:**
- Modify: `src/lib/3d/scenes/solar.ts` — rewrite as `Layer3d[]` using DSL
- Test: `src/lib/3d/scenes/solar.test.ts` — verify round-trip through compositor

**Step 1: Write the failing test**

Create `src/lib/3d/scenes/solar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { solarLayers } from './solar';
import { composeLayers } from '../compositor';

describe('solarLayers', () => {
  it('exports an array of Layer3d', () => {
    expect(Array.isArray(solarLayers)).toBe(true);
    expect(solarLayers.length).toBeGreaterThan(0);
  });

  it('every layer has required fields', () => {
    for (const layer of solarLayers) {
      expect(layer.id).toBeTruthy();
      expect(layer.name).toBeTruthy();
      expect(typeof layer.visible).toBe('boolean');
      expect(Array.isArray(layer.entities)).toBe(true);
      expect(typeof layer.order).toBe('number');
    }
  });

  it('composes through compositor without error', () => {
    const content = composeLayers(solarLayers, 'solar');
    expect(content.entities.length).toBeGreaterThan(0);
    expect(content.id).toBe('solar');
  });

  it('sphere entity has animate callback after composition', () => {
    const content = composeLayers(solarLayers, 'solar');
    const sphere = content.entities.find(e => e.id.includes('sphere'));
    expect(sphere).toBeDefined();
    expect(typeof sphere!.animate).toBe('function');
  });

  it('floor entity has no animate callback', () => {
    const content = composeLayers(solarLayers, 'solar');
    const floor = content.entities.find(e => e.id.includes('floor'));
    expect(floor).toBeDefined();
    expect(floor!.animate).toBeUndefined();
  });

  it('has onThemeChange for sphere themeResponse', () => {
    const content = composeLayers(solarLayers, 'solar');
    expect(typeof content.onThemeChange).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/3d/scenes/solar.test.ts`
Expected: FAIL — `solarLayers` not exported

**Step 3: Rewrite solar.ts**

Rewrite `src/lib/3d/scenes/solar.ts` to export `solarLayers: Layer3d[]`. Keep `solarScene: SceneContent` as a computed export for backward compatibility during migration (compose on import).

```typescript
import type { Layer3d } from '../types';
import type { SceneContent } from '../scene-content.types';
import { composeLayers } from '../compositor';

// --- Layer: Ground ---
const groundLayer: Layer3d = {
  id: 'ground',
  name: 'Ground',
  visible: true,
  text: 'Transparent grid floor',
  entities: [
    {
      id: 'floor',
      mesh: 'plane',
      material: { diffuse: [0.5, 0.5, 0.55] },
      position: [0, -1, 0],
      scale: [80, 1, 80],
      opacity: { map: 'grid', tiling: 4, blend: true },
    },
  ],
  order: 0,
  createdAt: new Date('2026-02-22'),
  updatedAt: new Date('2026-02-22'),
};

// --- Layer: Structures ---
const structuresLayer: Layer3d = {
  id: 'structures',
  name: 'Structures',
  visible: true,
  text: 'Sandy pyramid at the center',
  entities: [
    {
      id: 'pyramid',
      mesh: {
        type: 'cone',
        capSegments: 4,
        baseRadius: 1,
        peakRadius: 0,
        height: 2,
        heightSegments: 1,
      },
      material: {
        diffuse: [0.76, 0.7, 0.5],
        emissive: [0.06, 0.05, 0.03],
        specular: [0.4, 0.35, 0.25],
        metalness: 0.1,
        gloss: 0.4,
      },
      position: [0, 0, 0],
      rotation: [0, 45, 0],
    },
  ],
  order: 1,
  createdAt: new Date('2026-02-22'),
  updatedAt: new Date('2026-02-22'),
};

// --- Layer: Orbiting Objects ---
const orbitingLayer: Layer3d = {
  id: 'orbiting',
  name: 'Orbiting Objects',
  visible: true,
  text: 'Blue sphere orbiting the pyramid with a silver moon',
  entities: [
    {
      id: 'sphere',
      mesh: 'sphere',
      material: {
        diffuse: [0.23, 0.51, 0.96],
        emissive: [0.03, 0.06, 0.15],
        specular: [0.5, 0.6, 0.8],
        metalness: 0.3,
        gloss: 0.75,
      },
      scale: [1.5, 1.5, 1.5],
      followable: true,
      animate: [
        { type: 'orbit', radius: 8, speed: 0.3, bob: { amplitude: 0.25, speed: 0.8 } },
        { type: 'rotate', axis: 'y', speed: 12 },
      ],
      themeResponse: {
        light: {
          diffuse: [0.23, 0.51, 0.96],
          emissive: [0.03, 0.06, 0.15],
          specular: [0.5, 0.6, 0.8],
        },
        dark: {
          diffuse: [0.25, 0.5, 1.0],
          emissive: [0.06, 0.1, 0.25],
          specular: [0.4, 0.5, 0.9],
        },
      },
    },
    {
      id: 'moon',
      mesh: 'sphere',
      material: {
        diffuse: [0.75, 0.75, 0.78],
        emissive: [0.04, 0.04, 0.05],
        specular: [0.9, 0.9, 0.92],
        metalness: 0.6,
        gloss: 0.85,
      },
      scale: [0.15, 0.15, 0.15],
      followable: true,
      animate: {
        type: 'orbit',
        center: 'orbiting:sphere',  // namespaced reference
        radius: 1.875,
        speed: 0.6,
        tilt: 45,
      },
    },
  ],
  order: 2,
  createdAt: new Date('2026-02-22'),
  updatedAt: new Date('2026-02-22'),
};

export const solarLayers: Layer3d[] = [groundLayer, structuresLayer, orbitingLayer];

/** Backward-compatible composed scene (used during migration) */
export const solarScene: SceneContent = composeLayers(solarLayers, 'solar');
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/3d/scenes/solar.test.ts`
Expected: All 6 tests PASS

**Step 5: Verify the 3D page still works**

Run: `npm run check`
Expected: No type errors. The existing `+page.svelte` still imports `solarScene` which is still exported.

**Step 6: Commit**

```bash
git add src/lib/3d/scenes/solar.ts src/lib/3d/scenes/solar.test.ts
git commit -m "refactor(3d): convert solar scene to Layer3d[] with animation DSL

Three layers (ground, structures, orbiting objects) using declarative
animation specs. Backward-compatible solarScene export via compositor."
```

---

## Task 5: Dexie files3d Table & File3d Store

**Files:**
- Modify: `src/lib/db/index.ts` — add `files3d` table (version 3)
- Create: `src/lib/stores/files3d.ts`
- Test: `src/lib/stores/files3d.test.ts`

**Step 1: Add Dexie table**

In `src/lib/db/index.ts`, add the `files3d` table:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { ConceptFile, AppSettings } from '$lib/types';
import type { File3d } from '$lib/3d/types';

class ConceptDB extends Dexie {
  files!: EntityTable<ConceptFile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  files3d!: EntityTable<File3d, 'id'>;

  constructor() {
    super('ConceptVisualizerDB');
    this.version(1).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
    this.version(2).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
    this.version(3).stores({
      files: 'id, title, updatedAt',
      settings: 'id',
      files3d: 'id, title, updatedAt'
    });
  }
}

export const db = new ConceptDB();
```

**Step 2: Write failing store test**

Create `src/lib/stores/files3d.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { files3dStore } from './files3d';
import { db } from '$lib/db';

describe('files3dStore', () => {
  beforeEach(async () => {
    await db.files3d.clear();
    await files3dStore.init();
  });

  it('should start with empty state', () => {
    const state = get(files3dStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();
  });

  it('should create a new File3d with default layer', async () => {
    const file = await files3dStore.create('My Scene');
    expect(file.title).toBe('My Scene');
    expect(file.layers).toHaveLength(1);
    expect(file.layers[0].name).toBe('Layer 1');

    const state = get(files3dStore);
    expect(state.activeFileId).toBe(file.id);
    expect(state.files).toHaveLength(1);
  });

  it('should delete a file', async () => {
    const file = await files3dStore.create('To Delete');
    await files3dStore.remove(file.id);

    const state = get(files3dStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();
  });

  it('should rename a file', async () => {
    const file = await files3dStore.create('Old');
    await files3dStore.rename(file.id, 'New');

    const state = get(files3dStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.title).toBe('New');
  });

  it('should save layers to a file', async () => {
    const file = await files3dStore.create('Scene');
    const layer = { ...file.layers[0], name: 'Updated Layer' };
    await files3dStore.updateLayers(file.id, [layer]);

    const saved = await db.files3d.get(file.id);
    expect(saved?.layers[0].name).toBe('Updated Layer');
  });

  it('should load files on init', async () => {
    await db.files3d.add({
      id: 'preexisting',
      title: 'Pre-existing',
      createdAt: new Date(),
      updatedAt: new Date(),
      layers: [],
      theme: 'light',
    });

    await files3dStore.init();
    const state = get(files3dStore);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].id).toBe('preexisting');
  });

  it('should set active file', async () => {
    const f1 = await files3dStore.create('One');
    const f2 = await files3dStore.create('Two');
    files3dStore.setActive(f1.id);

    const state = get(files3dStore);
    expect(state.activeFileId).toBe(f1.id);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/files3d.test.ts`
Expected: FAIL — module `./files3d` not found

**Step 4: Write the store**

Create `src/lib/stores/files3d.ts`:

```typescript
import { writable, get } from 'svelte/store';
import { v4 as uuid } from 'uuid';
import { db } from '$lib/db';
import type { File3d, Layer3d } from '$lib/3d/types';

interface Files3dState {
  files: File3d[];
  activeFileId: string | null;
}

function createFiles3dStore() {
  const { subscribe, set, update } = writable<Files3dState>({
    files: [],
    activeFileId: null,
  });

  async function init() {
    const files = await db.files3d.orderBy('updatedAt').reverse().toArray();
    const state = get({ subscribe });
    set({
      files,
      activeFileId: state.activeFileId ?? files[0]?.id ?? null,
    });
  }

  async function create(title: string): Promise<File3d> {
    const now = new Date();
    const defaultLayer: Layer3d = {
      id: uuid(),
      name: 'Layer 1',
      visible: true,
      text: '',
      entities: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const file: File3d = {
      id: uuid(),
      title,
      createdAt: now,
      updatedAt: now,
      layers: [defaultLayer],
      theme: 'light',
    };
    await db.files3d.add(file);
    update(s => ({
      files: [file, ...s.files],
      activeFileId: file.id,
    }));
    return file;
  }

  async function remove(id: string) {
    await db.files3d.delete(id);
    update(s => {
      const files = s.files.filter(f => f.id !== id);
      return {
        files,
        activeFileId: s.activeFileId === id ? (files[0]?.id ?? null) : s.activeFileId,
      };
    });
  }

  async function rename(id: string, title: string) {
    const now = new Date();
    await db.files3d.update(id, { title, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, title, updatedAt: now } : f),
    }));
  }

  async function updateLayers(id: string, layers: Layer3d[]) {
    const now = new Date();
    await db.files3d.update(id, { layers, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, layers, updatedAt: now } : f),
    }));
  }

  async function updateCamera(id: string, camera: File3d['camera']) {
    const now = new Date();
    await db.files3d.update(id, { camera, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, camera, updatedAt: now } : f),
    }));
  }

  function setActive(id: string) {
    update(s => ({ ...s, activeFileId: id }));
  }

  return {
    subscribe,
    init,
    create,
    remove,
    rename,
    updateLayers,
    updateCamera,
    setActive,
  };
}

export const files3dStore = createFiles3dStore();
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/files3d.test.ts`
Expected: All 7 tests PASS

**Step 6: Commit**

```bash
git add src/lib/db/index.ts src/lib/stores/files3d.ts src/lib/stores/files3d.test.ts
git commit -m "feat(3d): add files3d Dexie table and files3dStore

Separate IndexedDB table for 3D scene files. Store follows
same pattern as 2D filesStore: CRUD ops, init, setActive."
```

---

## Task 6: Voice Input Component

**Files:**
- Create: `src/lib/components/3d/VoiceInput.svelte`

Web Speech API component — no test file (browser API, requires manual testing).

**Step 1: Create the component**

Create `src/lib/components/3d/VoiceInput.svelte`:

```svelte
<script lang="ts">
  interface Props {
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
    disabled?: boolean;
  }

  let { onTranscript, onInterim, disabled = false }: Props = $props();

  let recording = $state(false);
  let supported = $state(false);
  let interimText = $state('');
  let recognition: SpeechRecognition | null = null;

  // Feature detect
  if (typeof window !== 'undefined') {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    supported = !!SpeechRecognition;
    if (supported) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (interim) {
          interimText = interim;
          onInterim?.(interim);
        }
        if (final) {
          onTranscript(final);
          interimText = '';
        }
      };

      recognition.onerror = () => {
        recording = false;
        interimText = '';
      };

      recognition.onend = () => {
        recording = false;
        interimText = '';
      };
    }
  }

  function toggle() {
    if (!recognition) return;
    if (recording) {
      recognition.stop();
    } else {
      recognition.start();
      recording = true;
    }
  }
</script>

{#if supported}
  <button
    class="voice-btn"
    class:recording
    onclick={toggle}
    {disabled}
    aria-label={recording ? 'Stop recording' : 'Start voice input'}
    title={recording ? 'Stop recording' : 'Voice input'}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      {#if recording}
        <rect x="6" y="6" width="12" height="12" rx="2" />
      {:else}
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      {/if}
    </svg>
  </button>
{/if}

<style>
  .voice-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    cursor: pointer;
    transition: all 0.15s;
  }

  .voice-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .voice-btn.recording {
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
    animation: pulse 1.5s infinite;
  }

  .voice-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  }
</style>
```

**Step 2: Verify it compiles**

Run: `npm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/components/3d/VoiceInput.svelte
git commit -m "feat(3d): add VoiceInput component with Web Speech API

Mic button: press to start, press to stop. Continuous mode with
interim results. Red pulse animation when recording. Graceful
degradation if browser doesn't support Speech API."
```

---

## Task 7: Layers Panel Component

**Files:**
- Create: `src/lib/components/3d/LayersPanel.svelte`

This is the main UI for composing scenes. Uses glassmorphic styling consistent with existing controls.

**Step 1: Create the component**

Create `src/lib/components/3d/LayersPanel.svelte`:

```svelte
<script lang="ts">
  import type { Layer3d, SerializableEntitySpec } from '$lib/3d/types';
  import VoiceInput from './VoiceInput.svelte';

  interface Props {
    layers: Layer3d[];
    onToggleVisibility: (layerId: string) => void;
    onUpdateText: (layerId: string, text: string) => void;
    onUpdateEntities: (layerId: string, entities: SerializableEntitySpec[]) => void;
    onAddLayer: () => void;
    onRemoveLayer: (layerId: string) => void;
    onGenerate?: (layerId: string, text: string) => void;
  }

  let {
    layers,
    onToggleVisibility,
    onUpdateText,
    onUpdateEntities,
    onAddLayer,
    onRemoveLayer,
    onGenerate,
  }: Props = $props();

  let expandedLayerId: string | null = $state(null);
  let jsonErrors: Record<string, string> = $state({});

  function toggleExpand(layerId: string) {
    expandedLayerId = expandedLayerId === layerId ? null : layerId;
  }

  function handleJsonEdit(layerId: string, value: string) {
    try {
      const parsed = JSON.parse(value) as SerializableEntitySpec[];
      jsonErrors = { ...jsonErrors, [layerId]: '' };
      onUpdateEntities(layerId, parsed);
    } catch (e) {
      jsonErrors = { ...jsonErrors, [layerId]: (e as Error).message };
    }
  }

  function handleVoiceTranscript(layerId: string, text: string) {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      onUpdateText(layerId, layer.text + (layer.text ? ' ' : '') + text);
    }
  }
</script>

<div class="layers-panel">
  <div class="panel-header">
    <span class="panel-title">Layers</span>
    <button class="add-btn" onclick={onAddLayer} aria-label="Add layer" title="Add layer">+</button>
  </div>

  <div class="panel-body">
    {#each layers.sort((a, b) => a.order - b.order) as layer (layer.id)}
      <div class="layer-row" class:hidden-layer={!layer.visible}>
        <div class="layer-header">
          <button
            class="visibility-btn"
            onclick={() => onToggleVisibility(layer.id)}
            aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
            title={layer.visible ? 'Hide layer' : 'Show layer'}
          >
            {#if layer.visible}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>
              </svg>
            {/if}
          </button>

          <button class="layer-name" onclick={() => toggleExpand(layer.id)}>
            <span class="expand-arrow">{expandedLayerId === layer.id ? '\u25BE' : '\u25B8'}</span>
            {layer.name}
            <span class="entity-count">({layer.entities.length})</span>
          </button>

          <button
            class="remove-btn"
            onclick={() => onRemoveLayer(layer.id)}
            aria-label="Remove layer"
            title="Remove layer"
          >&times;</button>
        </div>

        {#if expandedLayerId === layer.id}
          <div class="layer-detail">
            <div class="text-row">
              <textarea
                class="layer-text"
                value={layer.text}
                placeholder="Describe this layer..."
                oninput={(e) => onUpdateText(layer.id, (e.target as HTMLTextAreaElement).value)}
                rows="2"
              ></textarea>
              <VoiceInput
                onTranscript={(text) => handleVoiceTranscript(layer.id, text)}
              />
            </div>

            <textarea
              class="json-editor"
              value={JSON.stringify(layer.entities, null, 2)}
              oninput={(e) => handleJsonEdit(layer.id, (e.target as HTMLTextAreaElement).value)}
              rows="6"
              spellcheck="false"
            ></textarea>
            {#if jsonErrors[layer.id]}
              <div class="json-error">{jsonErrors[layer.id]}</div>
            {/if}

            <div class="layer-actions">
              {#if onGenerate}
                <button
                  class="action-btn"
                  onclick={() => onGenerate(layer.id, layer.text)}
                  disabled={!layer.text.trim()}
                  title="Generate entities from text description"
                >Generate</button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .layers-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 280px;
    max-height: calc(100vh - 200px);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 15;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 13px;
    color: var(--pad-icon);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--glass-border);
  }

  .panel-title {
    font-weight: 600;
    font-size: 13px;
  }

  .add-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .add-btn:hover {
    background: var(--pad-btn-bg-hover);
  }

  .panel-body {
    overflow-y: auto;
    flex: 1;
  }

  .layer-row {
    border-bottom: 1px solid var(--glass-border);
  }

  .layer-row:last-child {
    border-bottom: none;
  }

  .hidden-layer {
    opacity: 0.5;
  }

  .layer-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
  }

  .visibility-btn {
    background: none;
    border: none;
    color: var(--pad-icon);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    opacity: 0.7;
  }

  .visibility-btn:hover {
    opacity: 1;
  }

  .layer-name {
    flex: 1;
    background: none;
    border: none;
    color: var(--pad-icon);
    cursor: pointer;
    text-align: left;
    font-size: 12px;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .layer-name:hover {
    color: var(--pad-icon);
  }

  .expand-arrow {
    font-size: 10px;
    opacity: 0.6;
  }

  .entity-count {
    opacity: 0.5;
    font-size: 11px;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--pad-icon-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .layer-header:hover .remove-btn {
    opacity: 0.6;
  }

  .remove-btn:hover {
    opacity: 1 !important;
    color: #ef4444;
  }

  .layer-detail {
    padding: 4px 8px 8px;
  }

  .text-row {
    display: flex;
    gap: 4px;
    align-items: flex-start;
    margin-bottom: 6px;
  }

  .layer-text {
    flex: 1;
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    color: var(--pad-icon);
    padding: 6px 8px;
    font-size: 12px;
    resize: vertical;
    font-family: var(--font-main);
  }

  .json-editor {
    width: 100%;
    background: var(--pad-btn-bg);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    color: var(--pad-icon);
    padding: 6px 8px;
    font-size: 11px;
    font-family: monospace;
    resize: vertical;
    tab-size: 2;
  }

  .json-error {
    color: #ef4444;
    font-size: 11px;
    margin-top: 2px;
    padding: 0 4px;
  }

  .layer-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .action-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--pad-btn-bg-hover);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
```

**Step 2: Verify it compiles**

Run: `npm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/components/3d/LayersPanel.svelte
git commit -m "feat(3d): add LayersPanel component

Floating glass panel: layer visibility toggle, expand to edit text
and JSON, voice input, generate button. Glassmorphic styling
consistent with existing controls."
```

---

## Task 8: Hex File Browser Component

**Files:**
- Create: `src/lib/components/3d/FileBrowserHex.svelte`

Three-state hex: collapsed → fan-out (recents) → full panel.

**Step 1: Create the component**

Create `src/lib/components/3d/FileBrowserHex.svelte`:

```svelte
<script lang="ts">
  import type { File3d } from '$lib/3d/types';

  interface Props {
    files: File3d[];
    activeFileId: string | null;
    onSelectFile: (id: string) => void;
    onCreateFile: () => void;
    onDeleteFile?: (id: string) => void;
  }

  let { files, activeFileId, onSelectFile, onCreateFile, onDeleteFile }: Props = $props();

  type BrowseState = 'collapsed' | 'fanout' | 'panel';
  let browseState: BrowseState = $state('collapsed');
  let searchQuery = $state('');

  const MAX_FAN_FILES = 5;

  let activeFile = $derived(files.find(f => f.id === activeFileId));
  let recentFiles = $derived(
    files
      .filter(f => f.id !== activeFileId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, MAX_FAN_FILES)
  );
  let filteredFiles = $derived(
    searchQuery
      ? files.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : files
  );

  function handleHexClick() {
    browseState = browseState === 'collapsed' ? 'fanout' : 'collapsed';
  }

  function handleSelectFile(id: string) {
    onSelectFile(id);
    browseState = 'collapsed';
  }

  function handleMoreClick() {
    browseState = 'panel';
  }

  function handleNewClick() {
    onCreateFile();
    browseState = 'collapsed';
  }

  function handleOutsideClick() {
    browseState = 'collapsed';
  }

  // Fan-out geometry: arrange items in a semicircle below the hex
  function fanPosition(index: number, total: number): { x: number; y: number } {
    const startAngle = Math.PI * 0.15;
    const endAngle = Math.PI * 0.85;
    const radius = 70;
    const angle = total <= 1
      ? Math.PI * 0.5
      : startAngle + (endAngle - startAngle) * (index / (total - 1));
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  // Total fan items = recent files + "New" + maybe "More..."
  let fanItems = $derived(() => {
    const items: Array<{ type: 'file' | 'new' | 'more'; id?: string; label: string }> = [];
    for (const f of recentFiles) {
      items.push({ type: 'file', id: f.id, label: f.title });
    }
    items.push({ type: 'new', label: '+ New' });
    if (files.length > MAX_FAN_FILES + 1) {
      items.push({ type: 'more', label: '...' });
    }
    return items;
  });
</script>

<!-- Overlay to catch outside clicks when open -->
{#if browseState !== 'collapsed'}
  <button
    class="backdrop"
    onclick={handleOutsideClick}
    aria-label="Close file browser"
  ></button>
{/if}

<div class="file-browser">
  <!-- Main hex button -->
  <button class="hex-btn" onclick={handleHexClick} aria-label="Browse files">
    <svg viewBox="0 0 60 52" width="60" height="52">
      <polygon
        points="56,26 43,48 17,48 4,26 17,4 43,4"
        stroke-width="1.5"
        stroke-linejoin="round"
        style="fill: var(--glass-bg); stroke: var(--glass-border);"
      />
      <text
        x="30" y="27"
        text-anchor="middle"
        dominant-baseline="central"
        fill="var(--pad-icon)"
        font-size="10"
        font-family="var(--font-main)"
        font-weight="500"
      >{activeFile ? activeFile.title.slice(0, 6) : 'Files'}</text>
    </svg>
  </button>

  <!-- Fan-out: recent files radiating below -->
  {#if browseState === 'fanout'}
    <div class="fan-container">
      {#each fanItems() as item, i}
        {@const pos = fanPosition(i, fanItems().length)}
        <button
          class="fan-node"
          class:fan-new={item.type === 'new'}
          class:fan-more={item.type === 'more'}
          style="transform: translate({pos.x}px, {pos.y}px)"
          onclick={() => {
            if (item.type === 'file' && item.id) handleSelectFile(item.id);
            else if (item.type === 'new') handleNewClick();
            else if (item.type === 'more') handleMoreClick();
          }}
          aria-label={item.label}
          title={item.label}
        >
          <span class="fan-label">{item.label.slice(0, 8)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Full panel: scrollable list -->
  {#if browseState === 'panel'}
    <div class="file-panel">
      <input
        class="search-input"
        type="text"
        placeholder="Search files..."
        bind:value={searchQuery}
      />
      <div class="file-list">
        {#each filteredFiles as file (file.id)}
          <div class="file-item" class:active={file.id === activeFileId}>
            <button
              class="file-item-btn"
              onclick={() => handleSelectFile(file.id)}
            >{file.title}</button>
            {#if onDeleteFile && file.id !== activeFileId}
              <button
                class="file-delete-btn"
                onclick={() => onDeleteFile(file.id)}
                aria-label="Delete {file.title}"
              >&times;</button>
            {/if}
          </div>
        {/each}
      </div>
      <button class="panel-new-btn" onclick={handleNewClick}>+ New Scene</button>
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 14;
    border: none;
    cursor: default;
  }

  .file-browser {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 15;
  }

  .hex-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .hex-btn:hover {
    opacity: 1;
  }

  .fan-container {
    position: absolute;
    top: 40px;
    left: 24px;
  }

  .fan-node {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    animation: fan-in 0.2s ease-out both;
    margin-left: -24px;
    margin-top: -24px;
  }

  .fan-node:hover {
    background: var(--pad-btn-bg-hover);
    transform: translate(var(--x), var(--y)) scale(1.1);
  }

  .fan-new {
    border-color: rgba(59, 130, 246, 0.4);
  }

  .fan-more {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .fan-label {
    font-size: 9px;
    color: var(--pad-icon);
    text-align: center;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40px;
  }

  @keyframes fan-in {
    from { opacity: 0; transform: translate(0, 0) scale(0.5); }
    to { opacity: 1; }
  }

  .file-panel {
    position: absolute;
    top: 56px;
    left: 0;
    width: 220px;
    max-height: 300px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slide-down 0.15s ease-out;
  }

  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .search-input {
    margin: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid var(--glass-border);
    background: var(--pad-btn-bg);
    color: var(--pad-icon);
    font-size: 12px;
    outline: none;
  }

  .file-list {
    overflow-y: auto;
    flex: 1;
    padding: 0 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .file-item:hover {
    background: var(--pad-btn-bg-hover);
  }

  .file-item.active {
    background: var(--pad-btn-bg-active);
  }

  .file-item-btn {
    flex: 1;
    background: none;
    border: none;
    color: var(--pad-icon);
    text-align: left;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-delete-btn {
    background: none;
    border: none;
    color: var(--pad-icon-muted);
    cursor: pointer;
    padding: 4px 6px;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .file-item:hover .file-delete-btn {
    opacity: 0.6;
  }

  .file-delete-btn:hover {
    opacity: 1 !important;
    color: #ef4444;
  }

  .panel-new-btn {
    margin: 4px 8px 8px;
    padding: 6px;
    border-radius: 6px;
    border: 1px dashed var(--glass-border);
    background: transparent;
    color: var(--pad-icon);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .panel-new-btn:hover {
    background: var(--pad-btn-bg-hover);
  }
</style>
```

**Step 2: Verify it compiles**

Run: `npm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/components/3d/FileBrowserHex.svelte
git commit -m "feat(3d): add FileBrowserHex component

Three-state hex file browser: collapsed (single hex), fan-out
(recent files as radial nodes), full panel (scrollable list
with search). Glassmorphic styling."
```

---

## Task 9: Wire Everything Into the 3D Page

**Files:**
- Modify: `src/routes/3d/+page.svelte`

This is the integration task — connect the store, compositor, layers panel, and file browser to the engine.

**Step 1: Update the page**

Replace the existing `solarScene` import and `onMount` logic with the new store-driven flow. Key changes:

1. Import `files3dStore`, `composeLayers`, `solarLayers`, `LayersPanel`, `FileBrowserHex`
2. On mount: `files3dStore.init()`, load or create default file with `solarLayers`
3. Reactive compositor: when active file's layers change, recompose and reload scene
4. Wire LayersPanel callbacks to update the store
5. Wire FileBrowserHex to file CRUD operations
6. Move the `?` help button to avoid overlap with LayersPanel (shift it left of the panel)

In `src/routes/3d/+page.svelte`, the key wiring logic:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { files3dStore } from '$lib/stores/files3d';
  import { composeLayers } from '$lib/3d/compositor';
  import { solarLayers } from '$lib/3d/scenes/solar';
  import LayersPanel from '$lib/components/3d/LayersPanel.svelte';
  import FileBrowserHex from '$lib/components/3d/FileBrowserHex.svelte';
  import type { Layer3d, SerializableEntitySpec, File3d } from '$lib/3d/types';
  import { get } from 'svelte/store';
  import { v4 as uuid } from 'uuid';

  // ... existing state ...
  let layersPanelVisible = $state(true);
  let storeFiles: File3d[] = $state([]);
  let activeFileId: string | null = $state(null);
  let activeLayers: Layer3d[] = $state([]);

  onMount(() => {
    // ... existing theme + engine setup ...

    // Initialize 3D file store
    files3dStore.init().then(async () => {
      const state = get(files3dStore);
      if (state.files.length === 0) {
        // Create default file with solar layers
        const file = await files3dStore.create('Solar System');
        await files3dStore.updateLayers(file.id, structuredClone(solarLayers));
      }
      syncFromStore();
    });

    const unsub3d = files3dStore.subscribe(syncFromStore);

    return () => {
      unsub3d();
      // ... existing cleanup ...
    };
  });

  function syncFromStore() {
    const state = get(files3dStore);
    storeFiles = state.files;
    activeFileId = state.activeFileId;
    const activeFile = state.files.find(f => f.id === state.activeFileId);
    if (activeFile) {
      activeLayers = activeFile.layers;
      const content = composeLayers(activeFile.layers, activeFile.id);
      scene?.loadContent(content);
    }
  }

  // Layer panel callbacks
  function handleToggleVisibility(layerId: string) {
    const updated = activeLayers.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    if (activeFileId) files3dStore.updateLayers(activeFileId, updated);
  }

  function handleUpdateText(layerId: string, text: string) {
    const updated = activeLayers.map(l =>
      l.id === layerId ? { ...l, text, updatedAt: new Date() } : l
    );
    if (activeFileId) files3dStore.updateLayers(activeFileId, updated);
  }

  function handleUpdateEntities(layerId: string, entities: SerializableEntitySpec[]) {
    const updated = activeLayers.map(l =>
      l.id === layerId ? { ...l, entities, updatedAt: new Date() } : l
    );
    if (activeFileId) files3dStore.updateLayers(activeFileId, updated);
  }

  function handleAddLayer() {
    const now = new Date();
    const newLayer: Layer3d = {
      id: uuid(),
      name: `Layer ${activeLayers.length + 1}`,
      visible: true,
      text: '',
      entities: [],
      order: activeLayers.length,
      createdAt: now,
      updatedAt: now,
    };
    if (activeFileId) files3dStore.updateLayers(activeFileId, [...activeLayers, newLayer]);
  }

  function handleRemoveLayer(layerId: string) {
    const updated = activeLayers.filter(l => l.id !== layerId);
    if (activeFileId) files3dStore.updateLayers(activeFileId, updated);
  }

  // File browser callbacks
  async function handleCreateFile() {
    await files3dStore.create('Untitled Scene');
  }

  function handleSelectFile(id: string) {
    files3dStore.setActive(id);
  }

  async function handleDeleteFile(id: string) {
    await files3dStore.remove(id);
  }
</script>

<!-- In template, add after canvas: -->
{#if controlsVisible}
  <FileBrowserHex
    files={storeFiles}
    {activeFileId}
    onSelectFile={handleSelectFile}
    onCreateFile={handleCreateFile}
    onDeleteFile={handleDeleteFile}
  />

  {#if layersPanelVisible}
    <LayersPanel
      layers={activeLayers}
      onToggleVisibility={handleToggleVisibility}
      onUpdateText={handleUpdateText}
      onUpdateEntities={handleUpdateEntities}
      onAddLayer={handleAddLayer}
      onRemoveLayer={handleRemoveLayer}
    />
  {/if}

  <!-- Existing MovementDial and HexagonDial -->
{/if}
```

**Step 2: Verify it compiles**

Run: `npm run check`
Expected: No type errors

**Step 3: Manual test**

Run: `npm run dev`
Verify:
- 3D page loads with solar scene (composed from layers)
- Layers panel shows 3 layers (Ground, Structures, Orbiting Objects)
- Toggling layer visibility removes/adds entities from the scene
- File browser hex shows "Solar" title, fan-out shows "+ New"
- Creating a new file switches to empty scene
- Switching back to Solar System restores the scene

**Step 4: Commit**

```bash
git add src/routes/3d/+page.svelte
git commit -m "feat(3d): wire layers panel, file browser, and compositor into 3D page

Store-driven scene composition: file changes trigger recomposition
and engine reload. Layer toggling, text editing, JSON editing,
file create/switch/delete all functional."
```

---

## Task 10: Run Full Test Suite & Fix Regressions

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass including new ones

**Step 2: Run type check**

Run: `npm run check`
Expected: No type errors

**Step 3: Fix any failures**

Address any regressions from the Dexie version bump or import changes. The existing `db/index.test.ts` should still pass since we only added a table.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test regressions from 3D layers integration"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Animation DSL types + resolver | `animation-dsl.ts` | 7 |
| 2 | Layer3d, File3d, entity types | `types.ts`, `scene-content.types.ts` | type-check |
| 3 | Scene compositor | `compositor.ts` | 7 |
| 4 | Solar scene as Layer3d[] | `scenes/solar.ts` | 6 |
| 5 | Dexie table + files3d store | `db/index.ts`, `files3d.ts` | 7 |
| 6 | VoiceInput component | `VoiceInput.svelte` | type-check |
| 7 | LayersPanel component | `LayersPanel.svelte` | type-check |
| 8 | FileBrowserHex component | `FileBrowserHex.svelte` | type-check |
| 9 | Page wiring | `+page.svelte` | manual |
| 10 | Full test suite + regressions | — | all |

**Dependency order:** 1 → 2 → 3 → 4 → 5 → 6,7,8 (parallel) → 9 → 10
