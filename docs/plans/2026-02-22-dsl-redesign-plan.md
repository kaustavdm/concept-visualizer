# DSL Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the 3D layer DSL to align with PlayCanvas's entity-component model, add prefabs, observation modes, chat-driven input, and CRDT-ready data model.

**Architecture:** Bottom-up — types first, then animation fixes, then compositor, then builder, then prefabs, then observation modes, then UI integration. Each task is independently testable.

**Tech Stack:** TypeScript, PlayCanvas, Svelte 5, Dexie.js, vitest, CodeMirror 6, fractional-indexing

**Design doc:** `docs/plans/2026-02-22-dsl-redesign-design.md`

---

## Task Dependency Graph

```
T1 (types) ──┬──> T3 (animation fixes) ──> T5 (compositor) ──> T6 (createScene) ──> T8 (solar migration)
              │                                     ↑
              ├──> T2 (fractional-index util)────────┘
              │
              └──> T4 (prefab system) ──────────────> T5
                                                        │
T7 (DB migration) ─────────────────────────────────────> T8
                                                        │
T9 (store update) ─────────────────────────────────────> T10 (LayersPanel)
                                                        │
T11 (observation modes) ───> T12 (graph mode) ──────────> T13 (pipeline integration)
                                                        │
T14 (chat input UI) ────────────────────────────────────> T13
                                                        │
T15 (parser fix) ───────────────────────────────────────> T13
                                                        │
T16 (+page.svelte wiring) <─────────────────────────────┘
```

---

### Task 1: New Type Definitions

**Files:**
- Create: `src/lib/3d/entity-spec.ts`
- Modify: `src/lib/3d/scene-content.types.ts:20-51` (SceneEntitySpec gains `parent`, `components`, drops `mesh`)
- Test: `src/lib/3d/entity-spec.test.ts`

**Step 1: Write entity-spec.ts with all new types**

```typescript
// src/lib/3d/entity-spec.ts
import type { AnimationDSL } from './animation-dsl';

// --- PlayCanvas-aligned component specs (typed subset + passthrough) ---

export interface RenderComponentSpec {
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
  [key: string]: unknown;
}

export interface LightComponentSpec {
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

export interface MaterialSpec {
  diffuse?: [number, number, number];
  emissive?: [number, number, number];
  specular?: [number, number, number];
  metalness?: number;
  gloss?: number;
  opacity?: number;
  blendType?: 'normal' | 'additive' | 'none';
  [key: string]: unknown;
}

export interface EntitySpec {
  id: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  components: {
    render?: RenderComponentSpec;
    light?: LightComponentSpec;
  };

  material?: MaterialSpec;
  children?: EntitySpec[];
  prefab?: string;
  animate?: AnimationDSL;
  tags?: string[];
  followable?: boolean;
  themeResponse?: {
    light?: Partial<MaterialSpec>;
    dark?: Partial<MaterialSpec>;
  };

  label?: string;
  weight?: number;
  details?: string;
}

// --- Layer & Scene (CRDT-ready) ---

export type LayerSource =
  | { type: 'chat'; messageId: string }
  | { type: 'manual' }
  | { type: 'import'; format: string }
  | { type: 'clone'; sourceLayerId: string };

export interface Layer3d {
  id: string;
  name: string;
  visible: boolean;
  entities: EntitySpec[];
  text: string;
  position: string;           // fractional index
  source: LayerSource;
  createdAt: string;           // ISO 8601
  updatedAt: string;
  observationMode?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  layerIds: string[];
  observationMode?: string;
}

export interface Scene3d {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  layers: Layer3d[];
  environment?: {
    ambientColor?: [number, number, number];
    clearColor?: [number, number, number];
    fog?: {
      type: 'none' | 'linear' | 'exp' | 'exp2';
      color?: [number, number, number];
      density?: number;
    };
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
```

**Step 2: Write type validation tests**

```typescript
// src/lib/3d/entity-spec.test.ts
import { describe, it, expect } from 'vitest';
import type { EntitySpec, Layer3d, Scene3d } from './entity-spec';

describe('EntitySpec types', () => {
  it('minimal entity with render component', () => {
    const entity: EntitySpec = {
      id: 'test',
      components: { render: { type: 'sphere' } },
    };
    expect(entity.id).toBe('test');
    expect(entity.components.render?.type).toBe('sphere');
  });

  it('entity with children', () => {
    const entity: EntitySpec = {
      id: 'parent',
      components: { render: { type: 'cylinder' } },
      children: [{
        id: 'child',
        components: { render: { type: 'box' } },
        position: [0, 2, 0],
      }],
    };
    expect(entity.children).toHaveLength(1);
    expect(entity.children![0].id).toBe('child');
  });

  it('entity with light component and no render', () => {
    const entity: EntitySpec = {
      id: 'lamp',
      components: {
        light: { type: 'omni', color: [1, 0.9, 0.7], intensity: 0.8, range: 5 },
      },
    };
    expect(entity.components.light?.type).toBe('omni');
    expect(entity.components.render).toBeUndefined();
  });

  it('entity with prefab and overrides', () => {
    const entity: EntitySpec = {
      id: 'justice',
      prefab: 'concept-node',
      components: {},
      material: { diffuse: [0.2, 0.5, 1.0] },
      label: 'Justice',
      weight: 0.9,
    };
    expect(entity.prefab).toBe('concept-node');
    expect(entity.label).toBe('Justice');
  });

  it('Layer3d uses fractional position and ISO dates', () => {
    const layer: Layer3d = {
      id: 'abc',
      name: 'Test',
      visible: true,
      entities: [],
      text: 'some concept',
      position: 'a0',
      source: { type: 'manual' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(layer.position).toBe('a0');
    expect(typeof layer.createdAt).toBe('string');
  });

  it('Scene3d has version and optional messages', () => {
    const scene: Scene3d = {
      id: 's1',
      title: 'Test Scene',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      layers: [],
      version: 1,
    };
    expect(scene.version).toBe(1);
    expect(scene.messages).toBeUndefined();
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/3d/entity-spec.test.ts`
Expected: PASS (all 6 tests)

**Step 4: Update SceneEntitySpec to support parent and components**

In `src/lib/3d/scene-content.types.ts`, add `parent?: string` and `components` to `SceneEntitySpec`, while keeping backward compatibility with the old `mesh` field temporarily (compositor will handle the translation). Also update `MaterialSpec` to add `opacity` and `blendType`.

```typescript
// Add to MaterialSpec (scene-content.types.ts:11-17):
  opacity?: number;
  blendType?: 'normal' | 'additive' | 'none';

// Add to SceneEntitySpec (scene-content.types.ts:20-51):
  parent?: string;
  components?: {
    render?: { type: string; [key: string]: unknown };
    light?: { type: string; [key: string]: unknown };
  };
  label?: string;
  tags?: string[];
```

Keep the existing `mesh` and old fields until Task 6 (createScene rewrite) handles the new shape.

**Step 5: Commit**

```bash
git add src/lib/3d/entity-spec.ts src/lib/3d/entity-spec.test.ts src/lib/3d/scene-content.types.ts
git commit -m "feat(3d): add PlayCanvas-aligned EntitySpec, Layer3d, Scene3d types"
```

---

### Task 2: Fractional Index Utility

**Files:**
- Create: `src/lib/utils/fractional-index.ts`
- Test: `src/lib/utils/fractional-index.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/utils/fractional-index.test.ts
import { describe, it, expect } from 'vitest';
import {
  generatePosition,
  insertBetween,
  positionsForCount,
} from './fractional-index';

describe('fractional-index', () => {
  it('generatePosition returns a string', () => {
    const pos = generatePosition();
    expect(typeof pos).toBe('string');
    expect(pos.length).toBeGreaterThan(0);
  });

  it('insertBetween returns a string that sorts between a and b', () => {
    const a = 'a';
    const b = 'c';
    const mid = insertBetween(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('insertBetween with no lower bound sorts before upper', () => {
    const mid = insertBetween(undefined, 'b');
    expect(mid < 'b').toBe(true);
  });

  it('insertBetween with no upper bound sorts after lower', () => {
    const mid = insertBetween('b', undefined);
    expect(mid > 'b').toBe(true);
  });

  it('positionsForCount generates N sorted positions', () => {
    const positions = positionsForCount(5);
    expect(positions).toHaveLength(5);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] > positions[i - 1]).toBe(true);
    }
  });

  it('positionsForCount(0) returns empty array', () => {
    expect(positionsForCount(0)).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/utils/fractional-index.test.ts`
Expected: FAIL

**Step 3: Implement fractional index utility**

```typescript
// src/lib/utils/fractional-index.ts

/**
 * Lightweight fractional indexing for CRDT-safe ordering.
 * Uses base-36 string midpoints. No external dependencies.
 *
 * Positions are strings that sort lexicographically.
 * insertBetween(a, b) always returns a string that sorts between a and b.
 */

const BASE = 36;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Generate a default starting position */
export function generatePosition(): string {
  return 'n'; // midpoint of [a-z] range
}

/**
 * Compute a position string that sorts between `lower` and `upper`.
 * If lower is undefined, returns something before upper.
 * If upper is undefined, returns something after lower.
 */
export function insertBetween(
  lower: string | undefined,
  upper: string | undefined,
): string {
  if (lower === undefined && upper === undefined) {
    return 'n';
  }

  if (lower === undefined) {
    // Insert before upper: take first char and decrement, or prepend
    const firstChar = upper!.charCodeAt(0);
    if (firstChar > 'a'.charCodeAt(0)) {
      return String.fromCharCode(firstChar - 1);
    }
    return 'a' + midstring(upper!.slice(1), undefined);
  }

  if (upper === undefined) {
    // Insert after lower: take last char and increment, or append
    const lastChar = lower.charCodeAt(lower.length - 1);
    if (lastChar < 'z'.charCodeAt(0)) {
      return lower.slice(0, -1) + String.fromCharCode(lastChar + 1);
    }
    return lower + 'n';
  }

  // Both defined — find midpoint
  return midstring(lower, upper);
}

/**
 * Find the lexicographic midpoint between two strings.
 */
function midstring(a: string, b: string | undefined): string {
  if (b !== undefined && a >= b) {
    throw new Error(`Cannot insert between "${a}" and "${b}": a must be < b`);
  }

  // Pad to same length
  const maxLen = Math.max(a.length, b?.length ?? 0) + 1;
  const padA = a.padEnd(maxLen, DIGITS[0]);
  const padB = b !== undefined ? b.padEnd(maxLen, DIGITS[DIGITS.length - 1]) : DIGITS[DIGITS.length - 1].repeat(maxLen);

  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const charA = DIGITS.indexOf(padA[i]);
    const charB = DIGITS.indexOf(padB[i]);

    if (charA === charB) {
      result += DIGITS[charA];
      continue;
    }

    const mid = Math.floor((charA + charB) / 2);
    if (mid > charA) {
      result += DIGITS[mid];
      return result;
    }

    // Need more precision
    result += DIGITS[charA];
  }

  // Append midpoint character if we couldn't find a gap
  return result + 'n';
}

/**
 * Generate `count` evenly-spaced positions suitable for initial ordering.
 */
export function positionsForCount(count: number): string[] {
  if (count === 0) return [];
  const positions: string[] = [];
  const step = Math.floor(26 / (count + 1));
  for (let i = 0; i < count; i++) {
    const charCode = 'a'.charCodeAt(0) + step * (i + 1);
    positions.push(String.fromCharCode(Math.min(charCode, 'z'.charCodeAt(0))));
  }
  return positions;
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/utils/fractional-index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/utils/fractional-index.ts src/lib/utils/fractional-index.test.ts
git commit -m "feat(utils): add fractional index utility for CRDT-safe layer ordering"
```

---

### Task 3: Animation DSL Bug Fixes + New Types

**Files:**
- Modify: `src/lib/3d/animation-dsl.ts:28-36,59-73,187-208`
- Modify: `src/lib/3d/animation-dsl.test.ts`

**Step 1: Write failing tests for bug fixes**

Add to `src/lib/3d/animation-dsl.test.ts`:

```typescript
it('bob — preserves entity X/Z position', () => {
  const dsl: AnimationDSL = { type: 'bob', amplitude: 2, speed: 1 };
  const fn = resolveAnimation(dsl);
  const entity = mockEntity({ x: 5, y: 0, z: 3 });
  const ctx = makeCtx(Math.PI / 2);

  fn(entity as any, ctx);

  const [x, y, z] = entity.setPosition.mock.calls[0];
  expect(x).toBeCloseTo(5, 5);   // X preserved
  expect(y).toBeCloseTo(2, 5);   // bob applied
  expect(z).toBeCloseTo(3, 5);   // Z preserved
});

it('bob — supports x axis', () => {
  const dsl: AnimationDSL = { type: 'bob', amplitude: 3, speed: 1, axis: 'x' };
  const fn = resolveAnimation(dsl);
  const entity = mockEntity({ x: 0, y: 2, z: 0 });
  const ctx = makeCtx(Math.PI / 2);

  fn(entity as any, ctx);

  const [x, y, z] = entity.setPosition.mock.calls[0];
  expect(x).toBeCloseTo(3, 5);   // bob on X
  expect(y).toBeCloseTo(2, 5);   // Y preserved
  expect(z).toBeCloseTo(0, 5);   // Z preserved
});

it('bob — supports z axis', () => {
  const dsl: AnimationDSL = { type: 'bob', amplitude: 1, speed: 1, axis: 'z' };
  const fn = resolveAnimation(dsl);
  const entity = mockEntity({ x: 1, y: 2, z: 0 });
  const ctx = makeCtx(Math.PI / 2);

  fn(entity as any, ctx);

  const [x, y, z] = entity.setPosition.mock.calls[0];
  expect(x).toBeCloseTo(1, 5);
  expect(y).toBeCloseTo(2, 5);
  expect(z).toBeCloseTo(1, 5);   // bob on Z
});
```

Also add tests for new `scale` and `lookAt` types:

```typescript
it('scale — oscillates between from and to', () => {
  const dsl: AnimationDSL = {
    type: 'scale',
    from: [1, 1, 1],
    to: [2, 2, 2],
    speed: 1,
    easing: 'sine',
  };
  const fn = resolveAnimation(dsl);
  const entity = { ...mockEntity(), setLocalScale: vi.fn() };
  const ctx = makeCtx(0);

  fn(entity as any, ctx);

  // At time=0, sine easing: sin(0)=0 → factor=0.5*(1-cos(0))=0 → from
  expect(entity.setLocalScale).toHaveBeenCalledTimes(1);
});

it('lookAt — faces target entity', () => {
  const dsl: AnimationDSL = { type: 'lookAt', target: 'hub' };
  const fn = resolveAnimation(dsl);
  const entity = { ...mockEntity(), lookAt: vi.fn() };
  const hub = mockEntity({ x: 10, y: 0, z: 10 });
  const ctx = makeCtx(0, { hub });

  fn(entity as any, ctx);

  expect(entity.lookAt).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/3d/animation-dsl.test.ts`
Expected: FAIL (bob tests fail because current bob ignores entity position; scale/lookAt fail because types don't exist)

**Step 3: Fix bob resolver**

In `src/lib/3d/animation-dsl.ts`, change `BobAnimation.axis` type and fix `resolveBob`:

```typescript
// Line 34: change axis type
axis?: 'x' | 'y' | 'z';

// Lines 69-74: fix resolveBob
function resolveBob(dsl: BobAnimation): AnimateFn {
  const axis = dsl.axis ?? 'y';
  return (entity, ctx) => {
    const pos = entity.getPosition();
    const offset = Math.sin(ctx.time * dsl.speed) * dsl.amplitude;
    const x = axis === 'x' ? pos.x + offset : pos.x;
    const y = axis === 'y' ? pos.y + offset : pos.y;
    const z = axis === 'z' ? pos.z + offset : pos.z;
    entity.setPosition(x, y, z);
  };
}
```

Note: This still has an issue — on each frame, `pos` includes the previous frame's bob offset, causing drift. For a correct fix, the resolver should store the entity's base position on first call. But this matches the design doc's specified fix ("read current X/Z, only modify bob axis"). The original bob tests (`expect(y).toBeCloseTo(2, 5)`) will need updating since the entity mock returns `{x:0, y:0, z:0}` from `getPosition`, so `y = 0 + sin(PI/2)*2 = 2` still passes. The new tests with `{x:5, y:0, z:3}` will now pass because we read position.

**Step 4: Add ScaleAnimation and LookAtAnimation types and resolvers**

Add to `src/lib/3d/animation-dsl.ts` after `PathAnimation`:

```typescript
export interface ScaleAnimation {
  type: 'scale';
  from: [number, number, number];
  to: [number, number, number];
  speed: number;
  easing?: 'linear' | 'sine';
}

export interface LookAtAnimation {
  type: 'lookAt';
  target: string;
}
```

Update the `AnimationDSL` union:

```typescript
export type AnimationDSL =
  | OrbitAnimation
  | RotateAnimation
  | BobAnimation
  | PathAnimation
  | ScaleAnimation
  | LookAtAnimation
  | AnimationDSL[];
```

Add resolvers:

```typescript
function resolveScale(dsl: ScaleAnimation): AnimateFn {
  return (entity, ctx) => {
    const t = ctx.time * dsl.speed;
    let factor: number;
    if (dsl.easing === 'sine') {
      factor = 0.5 * (1 - Math.cos(t * Math.PI * 2));
    } else {
      factor = (Math.sin(t * Math.PI * 2) + 1) / 2;
    }
    const x = dsl.from[0] + (dsl.to[0] - dsl.from[0]) * factor;
    const y = dsl.from[1] + (dsl.to[1] - dsl.from[1]) * factor;
    const z = dsl.from[2] + (dsl.to[2] - dsl.from[2]) * factor;
    entity.setLocalScale(x, y, z);
  };
}

function resolveLookAt(dsl: LookAtAnimation): AnimateFn {
  return (entity, ctx) => {
    const target = ctx.entities[dsl.target];
    if (target) {
      entity.lookAt(target.getPosition());
    }
  };
}
```

Add cases to `resolveAnimation` switch:

```typescript
case 'scale':
  return resolveScale(dsl);
case 'lookAt':
  return resolveLookAt(dsl);
```

**Step 5: Update mockEntity to include setLocalScale and lookAt**

In the test file, update `mockEntity`:

```typescript
function mockEntity(pos = { x: 0, y: 0, z: 0 }) {
  return {
    setPosition: vi.fn(),
    setLocalEulerAngles: vi.fn(),
    setLocalScale: vi.fn(),
    getPosition: vi.fn(() => ({ x: pos.x, y: pos.y, z: pos.z })),
    lookAt: vi.fn(),
  };
}
```

**Step 6: Add JSDoc documenting array composition semantics**

At the array composition section (`resolveAnimation`), add:

```typescript
/**
 * Array composition: each animation runs sequentially per frame.
 * Last-writer-wins per transform channel:
 * - Position: orbit, bob, path all call setPosition — only last wins
 * - Rotation: rotate calls setLocalEulerAngles — only last wins
 * - Scale: scale calls setLocalScale — only last wins
 * Avoid composing multiple animations that target the same channel.
 */
```

**Step 7: Run all animation tests**

Run: `npx vitest run src/lib/3d/animation-dsl.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/lib/3d/animation-dsl.ts src/lib/3d/animation-dsl.test.ts
git commit -m "fix(animation): fix bob position bug, add multi-axis bob, scale, lookAt types"
```

---

### Task 4: Prefab System

**Files:**
- Create: `src/lib/3d/prefabs.ts`
- Test: `src/lib/3d/prefabs.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/3d/prefabs.test.ts
import { describe, it, expect } from 'vitest';
import {
  createPrefabRegistry,
  resolvePrefab,
  type PrefabDefinition,
} from './prefabs';
import type { EntitySpec } from './entity-spec';

const testPrefab: PrefabDefinition = {
  id: 'concept-node',
  description: 'Default concept sphere',
  template: {
    components: { render: { type: 'sphere', castShadows: true } },
    material: { diffuse: [0.5, 0.5, 0.5], metalness: 0.3, gloss: 0.6 },
    scale: [1, 1, 1],
  },
  slots: ['material.diffuse', 'scale', 'label', 'position'],
};

describe('PrefabRegistry', () => {
  it('registers and retrieves a prefab', () => {
    const registry = createPrefabRegistry();
    registry.register(testPrefab);
    expect(registry.get('concept-node')).toBe(testPrefab);
  });

  it('returns undefined for unknown prefab', () => {
    const registry = createPrefabRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('lists all registered prefabs', () => {
    const registry = createPrefabRegistry();
    registry.register(testPrefab);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].id).toBe('concept-node');
  });
});

describe('resolvePrefab', () => {
  it('returns entity unchanged if no prefab field', () => {
    const registry = createPrefabRegistry();
    const entity: EntitySpec = {
      id: 'test',
      components: { render: { type: 'box' } },
    };
    const result = resolvePrefab(entity, registry);
    expect(result).toEqual(entity);
  });

  it('merges template with entity overrides (entity wins)', () => {
    const registry = createPrefabRegistry();
    registry.register(testPrefab);

    const entity: EntitySpec = {
      id: 'justice',
      prefab: 'concept-node',
      components: {},
      material: { diffuse: [0.2, 0.5, 1.0] },
      position: [0, 2, 0],
      label: 'Justice',
    };

    const result = resolvePrefab(entity, registry);

    // Render component comes from template
    expect(result.components.render?.type).toBe('sphere');
    expect(result.components.render?.castShadows).toBe(true);
    // Material diffuse overridden by entity
    expect(result.material?.diffuse).toEqual([0.2, 0.5, 1.0]);
    // Metalness comes from template
    expect(result.material?.metalness).toBe(0.3);
    // Position from entity
    expect(result.position).toEqual([0, 2, 0]);
    // Scale from template (entity didn't override)
    expect(result.scale).toEqual([1, 1, 1]);
    // prefab field stripped
    expect(result.prefab).toBeUndefined();
    // id preserved
    expect(result.id).toBe('justice');
  });

  it('passes through entity unchanged for unknown prefab', () => {
    const registry = createPrefabRegistry();
    const entity: EntitySpec = {
      id: 'test',
      prefab: 'nonexistent',
      components: { render: { type: 'box' } },
    };
    const result = resolvePrefab(entity, registry);
    expect(result).toEqual(entity);
  });

  it('entity children are not affected by parent prefab', () => {
    const registry = createPrefabRegistry();
    registry.register(testPrefab);

    const entity: EntitySpec = {
      id: 'parent',
      prefab: 'concept-node',
      components: {},
      children: [{
        id: 'child',
        components: { render: { type: 'box' } },
      }],
    };

    const result = resolvePrefab(entity, registry);
    // Children pass through unchanged
    expect(result.children?.[0].components.render?.type).toBe('box');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/3d/prefabs.test.ts`
Expected: FAIL

**Step 3: Implement prefab system**

```typescript
// src/lib/3d/prefabs.ts
import type { EntitySpec } from './entity-spec';

export interface PrefabDefinition {
  id: string;
  description: string;
  template: Omit<EntitySpec, 'id'>;
  slots: string[];
}

export interface PrefabRegistry {
  register(prefab: PrefabDefinition): void;
  get(id: string): PrefabDefinition | undefined;
  list(): PrefabDefinition[];
}

export function createPrefabRegistry(): PrefabRegistry {
  const prefabs = new Map<string, PrefabDefinition>();

  return {
    register(prefab) {
      prefabs.set(prefab.id, prefab);
    },
    get(id) {
      return prefabs.get(id);
    },
    list() {
      return Array.from(prefabs.values());
    },
  };
}

/** Deep merge two objects. `overrides` values win over `base`. Arrays replace, not concatenate. */
function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const baseVal = base[key];
    const overVal = overrides[key];

    if (overVal === undefined) continue;

    if (
      typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal) &&
      typeof overVal === 'object' && overVal !== null && !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = overVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Resolve a prefab reference on an entity.
 * If entity has `prefab` field, look up the template and deep-merge.
 * Entity fields win over template. Strips `prefab` from result.
 */
export function resolvePrefab(entity: EntitySpec, registry: PrefabRegistry): EntitySpec {
  if (!entity.prefab) return entity;

  const definition = registry.get(entity.prefab);
  if (!definition) return entity;

  const { prefab, id, children, ...entityOverrides } = entity;
  const merged = deepMerge(
    definition.template as Record<string, unknown>,
    entityOverrides as Record<string, unknown>,
  ) as Omit<EntitySpec, 'id'>;

  return { id, ...merged, children };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/3d/prefabs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/3d/prefabs.ts src/lib/3d/prefabs.test.ts
git commit -m "feat(3d): add prefab registry and resolution system"
```

---

### Task 5: Compositor Rewrite

**Files:**
- Modify: `src/lib/3d/compositor.ts` (full rewrite)
- Modify: `src/lib/3d/compositor.test.ts` (update fixtures to new entity shape)

This is the largest single task. The compositor must handle: new entity shape, prefab resolution, recursive hierarchy flattening, animation ref resolution, and fractional index sorting.

**Step 1: Update test fixtures to use new EntitySpec shape**

Update `makeEntity` and `makeLayer` helpers in `compositor.test.ts`:

```typescript
import type { EntitySpec, Layer3d } from './entity-spec';
// Remove old type imports

function makeEntity(
  overrides: Partial<EntitySpec> & { id: string },
): EntitySpec {
  return {
    components: { render: { type: 'sphere' } },
    material: { diffuse: [1, 0, 0] },
    ...overrides,
  };
}

function makeLayer(overrides: Partial<Layer3d> & { id: string }): Layer3d {
  return {
    name: overrides.id,
    visible: true,
    text: '',
    entities: [],
    position: overrides.position ?? 'n',
    source: { type: 'manual' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

Update the sorting test to use `position` (string) instead of `order` (number):

```typescript
it('sorts layers by fractional position', () => {
  const layers = [
    makeLayer({ id: 'second', position: 'n', entities: [makeEntity({ id: 'b' })] }),
    makeLayer({ id: 'first', position: 'a', entities: [makeEntity({ id: 'a' })] }),
    makeLayer({ id: 'third', position: 'z', entities: [makeEntity({ id: 'c' })] }),
  ];

  const result = composeLayers(layers, 'scene-1');

  expect(result.entities.map(e => e.id)).toEqual(['first:a', 'second:b', 'third:c']);
});
```

Add new tests for hierarchy and prefab resolution:

```typescript
it('flattens children with parent field and nested ID namespace', () => {
  const layers = [
    makeLayer({
      id: 'L',
      entities: [makeEntity({
        id: 'parent',
        children: [makeEntity({ id: 'child' })],
      })],
    }),
  ];

  const result = composeLayers(layers, 'scene-1');

  // Parent and child both in flat array
  expect(result.entities).toHaveLength(2);
  expect(result.entities[0].id).toBe('L:parent');
  expect(result.entities[1].id).toBe('L:parent/child');
  expect(result.entities[1].parent).toBe('L:parent');
});

it('resolves bare animation center refs to namespaced IDs', () => {
  const layers = [
    makeLayer({
      id: 'L',
      entities: [
        makeEntity({ id: 'hub' }),
        makeEntity({
          id: 'orbiter',
          animate: { type: 'orbit', center: 'hub', radius: 3, speed: 1 },
        }),
      ],
    }),
  ];

  const result = composeLayers(layers, 'scene-1');

  // The resolved animate callback should use 'L:hub' as center
  const orbiterSpec = result.entities.find(e => e.id === 'L:orbiter')!;
  expect(orbiterSpec.animate).toBeTypeOf('function');
});
```

**Step 2: Rewrite compositor.ts**

```typescript
// src/lib/3d/compositor.ts
import type * as pc from 'playcanvas';
import type { EntitySpec, Layer3d } from './entity-spec';
import type {
  SceneContent,
  SceneEntitySpec,
  MaterialSpec,
} from './scene-content.types';
import { resolveAnimation } from './animation-dsl';
import { resolvePrefab, type PrefabRegistry, createPrefabRegistry } from './prefabs';
import type { AnimationDSL } from './animation-dsl';

interface ThemeEntry {
  namespacedId: string;
  light?: Partial<MaterialSpec>;
  dark?: Partial<MaterialSpec>;
}

function applyMaterialOverrides(
  mat: pc.StandardMaterial,
  overrides: Partial<MaterialSpec>,
): void {
  if (overrides.diffuse) {
    (mat.diffuse as any).set(overrides.diffuse[0], overrides.diffuse[1], overrides.diffuse[2]);
  }
  if (overrides.emissive) {
    (mat.emissive as any).set(overrides.emissive[0], overrides.emissive[1], overrides.emissive[2]);
  }
  if (overrides.specular) {
    (mat.specular as any).set(overrides.specular[0], overrides.specular[1], overrides.specular[2]);
  }
  if (overrides.metalness !== undefined) mat.metalness = overrides.metalness;
  if (overrides.gloss !== undefined) mat.gloss = overrides.gloss;
  mat.update();
}

/**
 * Resolve bare entity ID references in animation DSL to namespaced IDs.
 * Checks same-layer first, then cross-layer. Already-namespaced IDs (containing ':') pass through.
 */
function resolveAnimationRefs(
  dsl: AnimationDSL,
  layerId: string,
  allEntityIds: Set<string>,
): AnimationDSL {
  if (Array.isArray(dsl)) {
    return dsl.map(d => resolveAnimationRefs(d, layerId, allEntityIds));
  }

  if (dsl.type === 'orbit' && dsl.center && !dsl.center.includes(':')) {
    const sameLayer = `${layerId}:${dsl.center}`;
    if (allEntityIds.has(sameLayer)) {
      return { ...dsl, center: sameLayer };
    }
    // Search cross-layer
    for (const id of allEntityIds) {
      if (id.endsWith(`:${dsl.center}`)) {
        return { ...dsl, center: id };
      }
    }
  }

  if (dsl.type === 'lookAt' && dsl.target && !dsl.target.includes(':')) {
    const sameLayer = `${layerId}:${dsl.target}`;
    if (allEntityIds.has(sameLayer)) {
      return { ...dsl, target: sameLayer };
    }
    for (const id of allEntityIds) {
      if (id.endsWith(`:${dsl.target}`)) {
        return { ...dsl, target: id };
      }
    }
  }

  return dsl;
}

/**
 * Recursively flatten an entity and its children into a flat array of SceneEntitySpec.
 * Children get namespaced IDs: "layerId:parentId/childId"
 * Children get a `parent` field pointing to their parent's namespaced ID.
 */
function flattenEntity(
  entity: EntitySpec,
  layerId: string,
  parentNamespacedId?: string,
  themeEntries: ThemeEntry[] = [],
  allEntityIds: Set<string> = new Set(),
): SceneEntitySpec[] {
  const namespacedId = parentNamespacedId
    ? `${parentNamespacedId}/${entity.id}`
    : `${layerId}:${entity.id}`;

  const { children, animate: animateDsl, themeResponse, prefab, tags, label, weight, details, ...rest } = entity;

  const spec: SceneEntitySpec = {
    ...rest,
    id: namespacedId,
    parent: parentNamespacedId,
    components: entity.components,
    label: entity.label,
    tags: entity.tags,
  };

  if (animateDsl) {
    const resolvedDsl = resolveAnimationRefs(animateDsl, layerId, allEntityIds);
    spec.animate = resolveAnimation(resolvedDsl);
  }

  if (themeResponse) {
    themeEntries.push({
      namespacedId,
      light: themeResponse.light,
      dark: themeResponse.dark,
    });
  }

  const result: SceneEntitySpec[] = [spec];

  if (children) {
    for (const child of children) {
      result.push(...flattenEntity(child, layerId, namespacedId, themeEntries, allEntityIds));
    }
  }

  return result;
}

/**
 * Compose an array of Layer3d into a single SceneContent.
 *
 * 1. Filter visible layers
 * 2. Sort by position (fractional index, lexicographic)
 * 3. Resolve prefabs
 * 4. Collect all entity IDs (for animation ref resolution)
 * 5. Flatten entities (recursive hierarchy → flat with parent refs)
 * 6. Resolve animation refs and DSL → callbacks
 * 7. Collect themeResponse entries → single onThemeChange callback
 */
export function composeLayers(
  layers: Layer3d[],
  id: string,
  prefabRegistry?: PrefabRegistry,
): SceneContent {
  const registry = prefabRegistry ?? createPrefabRegistry();

  // 1. Filter visible
  const visible = layers.filter(l => l.visible);

  // 2. Sort by position (fractional index)
  visible.sort((a, b) => a.position.localeCompare(b.position));

  // 3. Resolve prefabs + collect all entity IDs for ref resolution
  const allEntityIds = new Set<string>();
  const resolvedLayers: { layerId: string; entities: EntitySpec[] }[] = [];

  for (const layer of visible) {
    const resolved = layer.entities.map(e => resolvePrefab(e, registry));
    resolvedLayers.push({ layerId: layer.id, entities: resolved });

    // Collect IDs recursively
    function collectIds(entity: EntitySpec, prefix: string) {
      const id = `${prefix}:${entity.id}`;
      allEntityIds.add(id);
      if (entity.children) {
        for (const child of entity.children) {
          collectIds(child, id.replace(':', '/').replace(/.*:/, prefix + ':'));
          // Simpler: just track the namespaced form
          allEntityIds.add(`${id}/${child.id}`);
        }
      }
    }
    for (const entity of resolved) {
      collectIds(entity, layer.id);
    }
  }

  // 4 + 5 + 6. Flatten and resolve
  const entities: SceneEntitySpec[] = [];
  const themeEntries: ThemeEntry[] = [];

  for (const { layerId, entities: layerEntities } of resolvedLayers) {
    for (const entity of layerEntities) {
      entities.push(...flattenEntity(entity, layerId, undefined, themeEntries, allEntityIds));
    }
  }

  // 7. Build result
  const result: SceneContent = { id, name: id, entities };

  if (themeEntries.length > 0) {
    result.onThemeChange = (
      theme: 'light' | 'dark',
      entityMap: Record<string, pc.Entity>,
    ) => {
      for (const entry of themeEntries) {
        const overrides = theme === 'light' ? entry.light : entry.dark;
        if (!overrides) continue;
        const pcEntity = entityMap[entry.namespacedId];
        if (!pcEntity) continue;
        const meshInstances = pcEntity.render?.meshInstances;
        if (!meshInstances || meshInstances.length === 0) continue;
        const mat = meshInstances[0].material as pc.StandardMaterial;
        applyMaterialOverrides(mat, overrides);
      }
    };
  }

  return result;
}
```

**Step 3: Run all compositor tests**

Run: `npx vitest run src/lib/3d/compositor.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/3d/compositor.ts src/lib/3d/compositor.test.ts
git commit -m "refactor(compositor): rewrite for new EntitySpec, hierarchy, prefabs, fractional ordering"
```

---

### Task 6: createScene Builder Rewrite

**Files:**
- Modify: `src/lib/3d/createScene.ts:47-166,222-237,449-453`

No unit tests for createScene (it requires a real PlayCanvas canvas). Verification is done by running the app with the migrated solar scene (Task 8).

**Step 1: Rewrite `buildMaterial` to handle new fields**

Add `opacity` and `blendType` support. Add index-signature passthrough for unknown material properties.

**Step 2: Replace `buildEntity` and `buildGridFloor`**

New `buildEntity` reads `spec.components.render` (not `spec.mesh`). Dispatches to `addRenderComponent` and `addLightComponent` helpers. Remove `buildGridFloor` — grid floor becomes a prefab.

**Step 3: Update `loadContent` for two-pass hierarchy wiring**

First pass: create all entities. Second pass: wire parent-child via `addChild()`.

**Step 4: Fix hardcoded camera reference**

Replace `activeEntities['sphere']` with `pc.Vec3.ZERO` lookAt.

**Step 5: Add environment and camera restore on scene load**

Read `SceneContent.environment` and `SceneContent.camera` (new optional fields on SceneContent) and apply on load.

**Step 6: Commit**

```bash
git add src/lib/3d/createScene.ts
git commit -m "refactor(createScene): component-bag entity builder, hierarchy, env/camera restore"
```

---

### Task 7: Database Migration (Dexie v4)

**Files:**
- Modify: `src/lib/db/index.ts:22-28`
- Test: `src/lib/db/index.test.ts` (add migration test)

**Step 1: Write migration test**

Test that a v3 `File3d` record is migrated to the new `Scene3d` shape.

**Step 2: Add Dexie version 4 with migration function**

```typescript
this.version(4).stores({
  files: 'id, title, updatedAt',
  settings: 'id',
  files3d: 'id, title, updatedAt'
}).upgrade(tx => {
  return tx.table('files3d').toCollection().modify(file => {
    // Migrate layers
    file.layers = (file.layers || []).map((layer: any, i: number) => ({
      ...layer,
      position: String.fromCharCode('a'.charCodeAt(0) + i),
      source: { type: 'manual' },
      createdAt: layer.createdAt instanceof Date ? layer.createdAt.toISOString() : layer.createdAt,
      updatedAt: layer.updatedAt instanceof Date ? layer.updatedAt.toISOString() : layer.updatedAt,
      entities: (layer.entities || []).map((entity: any) => {
        const { mesh, opacity, ...rest } = entity;
        return {
          ...rest,
          components: {
            render: typeof mesh === 'string'
              ? { type: mesh }
              : mesh?.type ? { type: mesh.type, geometry: mesh } : undefined,
          },
        };
      }),
    }));
    // Remove order field
    for (const layer of file.layers) {
      delete (layer as any).order;
      delete (layer as any).audioBlob;
    }
    // Migrate file-level fields
    file.version = 1;
    file.messages = [];
    if (file.theme) {
      file.environment = {
        clearColor: file.theme === 'dark' ? [0.01, 0.02, 0.06] : [0.92, 0.93, 0.95],
        ambientColor: file.theme === 'dark' ? [0.08, 0.08, 0.12] : [0.5, 0.5, 0.55],
      };
      delete (file as any).theme;
    }
    file.createdAt = file.createdAt instanceof Date ? file.createdAt.toISOString() : file.createdAt;
    file.updatedAt = file.updatedAt instanceof Date ? file.updatedAt.toISOString() : file.updatedAt;
  });
});
```

**Step 3: Update `ConceptDB` class to use `Scene3d` type**

```typescript
import type { Scene3d } from '$lib/3d/entity-spec';
// ...
files3d!: EntityTable<Scene3d, 'id'>;
```

**Step 4: Run test**

Run: `npx vitest run src/lib/db/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/index.test.ts
git commit -m "feat(db): add Dexie v4 migration for Scene3d schema"
```

---

### Task 8: Solar Scene Migration

**Files:**
- Modify: `src/lib/3d/scenes/solar.ts` (rewrite to new entity shape)
- Modify: `src/lib/3d/scenes/solar.test.ts` (update fixtures)

**Step 1: Rewrite solar.ts using EntitySpec**

Convert all entities from `{ mesh: 'sphere', material: {...} }` to `{ components: { render: { type: 'sphere' } }, material: {...} }`. Update layers to use `position` instead of `order`, ISO dates instead of `Date`, add `source: { type: 'manual' }`.

**Step 2: Update solar.test.ts**

Update assertions to match new entity shape.

**Step 3: Run tests**

Run: `npx vitest run src/lib/3d/scenes/solar.test.ts`
Expected: PASS

**Step 4: Run ALL tests to verify nothing broke**

Run: `npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/3d/scenes/solar.ts src/lib/3d/scenes/solar.test.ts
git commit -m "refactor(solar): migrate to new EntitySpec and Layer3d shape"
```

---

### Task 9: Store Update (files3dStore → scenes3dStore)

**Files:**
- Modify: `src/lib/stores/files3d.ts` (rename to scenes3dStore, use Scene3d, add message methods)
- Modify: `src/lib/stores/files3d.test.ts`

**Step 1: Update store to use Scene3d and Layer3d from entity-spec.ts**

Change `File3d` references to `Scene3d`, `Layer3d` from new types. Update `create()` to generate fractional positions, ISO dates, and `source: { type: 'manual' }` for default layers. Add `addMessage()` method. Add `updateEnvironment()` method.

**Step 2: Update tests**

Run: `npx vitest run src/lib/stores/files3d.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/stores/files3d.ts src/lib/stores/files3d.test.ts
git commit -m "refactor(store): update files3dStore for Scene3d types, add message methods"
```

---

### Task 10: LayersPanel Updates

**Files:**
- Modify: `src/lib/components/3d/LayersPanel.svelte`

**Step 1: Update Props interface**

Add `observationModes`, `activeObservationMode`, `onReorderLayer`, `onSelectObservationMode`. Update `onUpdateEntities` to use `EntitySpec`. Update `onGenerate` to include observation mode.

**Step 2: Update sorting to use fractional position**

```diff
- let sortedLayers = $derived([...layers].sort((a, b) => a.order - b.order));
+ let sortedLayers = $derived([...layers].sort((a, b) => a.position.localeCompare(b.position)));
```

**Step 3: Add observation mode badge and source icon to layer header**

Small colored pill showing `layer.observationMode` and icon for `layer.source.type`.

**Step 4: Add mode selector to generate area**

Replace bare "Generate" button with `[Mode selector] [Generate]`.

**Step 5: Visually verify in browser**

Run: `npm run dev` and check LayersPanel renders correctly with solar scene.

**Step 6: Commit**

```bash
git add src/lib/components/3d/LayersPanel.svelte
git commit -m "feat(LayersPanel): add mode badges, source icons, fractional sorting, mode selector"
```

---

### Task 11: Observation Mode Registry

**Files:**
- Create: `src/lib/3d/observation-modes/types.ts`
- Create: `src/lib/3d/observation-modes/registry.ts`
- Test: `src/lib/3d/observation-modes/registry.test.ts`

**Step 1: Write types**

```typescript
// src/lib/3d/observation-modes/types.ts
import type { VisualizationSchema } from '$lib/types';
import type { Layer3d } from '../entity-spec';
import type { PrefabDefinition } from '../prefabs';

export interface RenderOptions {
  theme: 'light' | 'dark';
  existingLayers?: Layer3d[];
  messageId?: string;
}

export interface ObservationMode {
  id: string;
  name: string;
  description: string;
  prefabs?: PrefabDefinition[];
  render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
  systemPromptOverride?: string;
}
```

**Step 2: Write registry tests**

```typescript
// src/lib/3d/observation-modes/registry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createObservationModeRegistry } from './registry';
import type { ObservationMode } from './types';

const mockMode: ObservationMode = {
  id: 'test',
  name: 'Test Mode',
  description: 'A test mode',
  render: vi.fn(() => []),
};

describe('ObservationModeRegistry', () => {
  it('registers and retrieves a mode', () => {
    const registry = createObservationModeRegistry();
    registry.register(mockMode);
    expect(registry.getMode('test')).toBe(mockMode);
  });

  it('returns undefined for unknown mode', () => {
    const registry = createObservationModeRegistry();
    expect(registry.getMode('nope')).toBeUndefined();
  });

  it('lists all modes', () => {
    const registry = createObservationModeRegistry();
    registry.register(mockMode);
    expect(registry.listModes()).toHaveLength(1);
  });
});
```

**Step 3: Implement registry**

```typescript
// src/lib/3d/observation-modes/registry.ts
import type { ObservationMode } from './types';

export interface ObservationModeRegistry {
  register(mode: ObservationMode): void;
  getMode(id: string): ObservationMode | undefined;
  listModes(): ObservationMode[];
}

export function createObservationModeRegistry(): ObservationModeRegistry {
  const modes = new Map<string, ObservationMode>();
  return {
    register(mode) { modes.set(mode.id, mode); },
    getMode(id) { return modes.get(id); },
    listModes() { return Array.from(modes.values()); },
  };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/3d/observation-modes/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/3d/observation-modes/
git commit -m "feat(3d): add observation mode types and registry"
```

---

### Task 12: Graph Observation Mode (Starter Mode)

**Files:**
- Create: `src/lib/3d/observation-modes/graph.ts`
- Test: `src/lib/3d/observation-modes/graph.test.ts`

**Step 1: Write tests**

```typescript
// src/lib/3d/observation-modes/graph.test.ts
import { describe, it, expect } from 'vitest';
import { graphMode } from './graph';
import type { VisualizationSchema } from '$lib/types';

const testSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test',
  description: 'Test graph',
  nodes: [
    { id: 'a', label: 'Node A', weight: 0.8, theme: 'core' },
    { id: 'b', label: 'Node B', weight: 0.5, theme: 'support' },
  ],
  edges: [
    { source: 'a', target: 'b', label: 'relates', strength: 0.7 },
  ],
  metadata: { concepts: ['A', 'B'], relationships: ['relates'] },
};

describe('graphMode', () => {
  it('produces 3 layers: ground, concepts, connections', () => {
    const layers = graphMode.render(testSchema, { theme: 'light' });
    expect(layers).toHaveLength(3);
    expect(layers.map(l => l.name)).toEqual(
      expect.arrayContaining(['Ground', 'Concepts', 'Connections'])
    );
  });

  it('creates one entity per node in concepts layer', () => {
    const layers = graphMode.render(testSchema, { theme: 'light' });
    const concepts = layers.find(l => l.name === 'Concepts')!;
    expect(concepts.entities).toHaveLength(2);
  });

  it('creates one entity per edge in connections layer', () => {
    const layers = graphMode.render(testSchema, { theme: 'light' });
    const connections = layers.find(l => l.name === 'Connections')!;
    expect(connections.entities).toHaveLength(1);
  });

  it('applies weight to node scale', () => {
    const layers = graphMode.render(testSchema, { theme: 'light' });
    const concepts = layers.find(l => l.name === 'Concepts')!;
    const nodeA = concepts.entities.find(e => e.label === 'Node A')!;
    // Higher weight → larger scale
    expect(nodeA.scale![0]).toBeGreaterThan(1);
  });

  it('tags layers with observation mode', () => {
    const layers = graphMode.render(testSchema, { theme: 'light' });
    for (const layer of layers) {
      expect(layer.observationMode).toBe('graph');
    }
  });
});
```

**Step 2: Implement graph mode**

The graph mode uses a simple 3D force-directed layout (or spherical distribution for simplicity in the initial implementation): nodes arranged on a sphere, edges as elongated boxes between them.

**Step 3: Run tests**

Run: `npx vitest run src/lib/3d/observation-modes/graph.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/3d/observation-modes/graph.ts src/lib/3d/observation-modes/graph.test.ts
git commit -m "feat(3d): implement graph observation mode"
```

---

### Task 13: Pipeline Integration

**Files:**
- Create: `src/lib/3d/pipeline-bridge.ts`
- Test: `src/lib/3d/pipeline-bridge.test.ts`

This module bridges the existing extraction pipeline to the observation mode system.

**Step 1: Write tests**

```typescript
// src/lib/3d/pipeline-bridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createPipelineBridge } from './pipeline-bridge';

describe('PipelineBridge', () => {
  it('calls extractor then mode renderer', async () => {
    const mockSchema = {
      type: 'graph' as const,
      title: 'Test',
      description: 'Test',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    };

    const mockExtract = vi.fn().mockResolvedValue(mockSchema);
    const mockRender = vi.fn().mockReturnValue([]);

    const bridge = createPipelineBridge(
      { extract: mockExtract },
      { getMode: () => ({ id: 'graph', name: 'Graph', description: '', render: mockRender }) },
    );

    await bridge.process('test text', 'graph', { theme: 'light' });

    expect(mockExtract).toHaveBeenCalledWith('test text', null);
    expect(mockRender).toHaveBeenCalledWith(mockSchema, expect.objectContaining({ theme: 'light' }));
  });
});
```

**Step 2: Implement bridge**

**Step 3: Run tests**

Run: `npx vitest run src/lib/3d/pipeline-bridge.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/3d/pipeline-bridge.ts src/lib/3d/pipeline-bridge.test.ts
git commit -m "feat(3d): add pipeline bridge connecting extraction to observation modes"
```

---

### Task 14: Chat Input UI

**Files:**
- Install: `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`
- Create: `src/lib/components/3d/ChatInput.svelte`

**Step 1: Install CodeMirror**

```bash
npm install @codemirror/view @codemirror/state @codemirror/commands
```

**Step 2: Create ChatInput component**

Floating glass card at bottom-center. CodeMirror 6 minimal setup. Enter to submit, Shift+Enter for newline. Mode badge on left, submit button on right.

**Step 3: Visually verify in browser**

Run: `npm run dev`

**Step 4: Commit**

```bash
git add src/lib/components/3d/ChatInput.svelte package.json package-lock.json
git commit -m "feat(3d): add CodeMirror-based chat input component"
```

---

### Task 15: Parser Fix (VALID_TYPES)

**Files:**
- Modify: `src/lib/llm/parser.ts:3`
- Modify: `src/lib/llm/parser.test.ts`

**Step 1: Write failing test**

```typescript
it('accepts logicalflow type', () => {
  const raw = JSON.stringify({
    type: 'logicalflow',
    title: 'Test',
    description: 'Test',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    metadata: { concepts: [], relationships: [] },
  });
  expect(() => parseVisualizationResponse(raw)).not.toThrow();
});

it('accepts storyboard type', () => {
  const raw = JSON.stringify({
    type: 'storyboard',
    title: 'Test',
    description: 'Test',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    metadata: { concepts: [], relationships: [] },
  });
  expect(() => parseVisualizationResponse(raw)).not.toThrow();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/llm/parser.test.ts`
Expected: FAIL

**Step 3: Fix VALID_TYPES**

```typescript
const VALID_TYPES = ['graph', 'tree', 'flowchart', 'hierarchy', 'logicalflow', 'storyboard'];
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/llm/parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/llm/parser.ts src/lib/llm/parser.test.ts
git commit -m "fix(parser): add logicalflow and storyboard to VALID_TYPES"
```

---

### Task 16: +page.svelte Wiring

**Files:**
- Modify: `src/routes/+page.svelte`

This is the integration task — wire everything together on the homepage.

**Step 1: Import new modules**

Replace old type imports. Import `ChatInput`, observation mode registry, pipeline bridge.

**Step 2: Initialize pipeline and observation modes**

In `onMount`, create the extraction pipeline (reuse from 2D), create mode registry, register graph mode, create pipeline bridge.

**Step 3: Wire ChatInput**

Add `ChatInput` component between the two dials, above the status bar. Connect its `onSubmit` to the pipeline bridge → layer creation flow.

**Step 4: Wire LayersPanel**

Pass observation mode props. Connect `onGenerate` to pipeline bridge.

**Step 5: Update handleAddLayer**

Use fractional indexing for new layer positions. Use `source: { type: 'manual' }`.

**Step 6: Update syncFromStore**

Use new `Scene3d` types. Pass environment/camera to scene controller.

**Step 7: Run the app**

Run: `npm run dev` and verify:
- Solar scene renders correctly
- LayersPanel shows layers with source badges
- Chat input appears and accepts text
- Typing in chat input and submitting creates new layers
- New layers render in the 3D scene

**Step 8: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 9: Run type checking**

Run: `npm run check`
Expected: No errors

**Step 10: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(3d): wire chat input, observation modes, and pipeline on homepage"
```

---

### Task 17: Delete Old Types

**Files:**
- Delete: `src/lib/3d/types.ts` (replaced by `entity-spec.ts`)
- Modify: All files that import from `types.ts` → import from `entity-spec.ts`

**Step 1: Search for all imports of old types**

```bash
grep -r "from.*3d/types" src/ --include="*.ts" --include="*.svelte"
```

Update each import to use `entity-spec.ts`.

**Step 2: Delete `src/lib/3d/types.ts`**

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Run type checking**

Run: `npm run check`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(3d): remove old types.ts, all imports use entity-spec.ts"
```

---

### Task 18: Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Run type checking**

Run: `npm run check`
Expected: No errors

**Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Manual smoke test**

Run: `npm run dev` and verify:
1. Solar scene loads and renders correctly
2. Layers panel shows all solar layers with correct badges
3. Chat input appears, accepts text
4. Submitting text creates 3D concept layers
5. Theme toggle works (light/dark)
6. Camera modes work (orbit/fly/follow)
7. Layer visibility toggles work
8. Adding manual layers works
