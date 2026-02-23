# Tiered Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken single-LLM-call extraction with a 3-tier progressive pipeline (JS → TF.js → LLM micro-prompts), add 6 new observation modes with prefabs and text rendering, and wire tier-granular version history with interrupt/undo.

**Architecture:** AsyncGenerator-based pipeline runner yields after each tier. Observation modes declare conceptual vocabularies (ModeRole[]) and prefabs. Text rendered via canvas-to-texture billboards and inscribed tablet entities. StatusBar shows pipeline progress with color-coded stage badges.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, PlayCanvas, TensorFlow.js (USE), compromise NLP, Dexie/IndexedDB, vitest + fake-indexeddb.

**Design doc:** `docs/plans/2026-02-23-tiered-pipeline-design.md`

---

## Phase 1: Type Foundation

Update all shared types first. No behavior changes — just extending interfaces so downstream code can compile.

### Task 1: Extend VisualizationNode and AppSettings

**Files:**
- Modify: `src/lib/types.ts:11-20` (VisualizationNode) and `src/lib/types.ts:45+` (AppSettings)
- Test: `src/lib/db/index.test.ts`, `src/lib/pipeline/orchestrator.test.ts`

**Step 1: Write test for new VisualizationNode field**

In the existing test file for types or a new one, verify `modeRole` is accepted:

```typescript
// src/lib/types.test.ts (or inline in existing test)
import { describe, it, expect } from 'vitest';
import type { VisualizationNode } from './types';

describe('VisualizationNode', () => {
  it('accepts modeRole field', () => {
    const node: VisualizationNode = {
      id: 'n1',
      label: 'Test',
      modeRole: 'agent',
    };
    expect(node.modeRole).toBe('agent');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/types.test.ts`
Expected: FAIL — `modeRole` does not exist on type `VisualizationNode`

**Step 3: Add `modeRole` to VisualizationNode, update AppSettings**

In `src/lib/types.ts`:

```typescript
// Add to VisualizationNode (after storyRole)
modeRole?: string;

// Add to AppSettings (after existing fields):
tier2Enabled: boolean;          // default true
tier3Enabled: boolean;          // default true
llmEnrichmentLevel: 'minimal' | 'full';
defaultObservationMode: string;

// Remove from AppSettings:
// extractionEngine: ExtractionEngineId;
// pipelineMode: 'auto' | 'manual';
// llmRefinement: boolean;
```

Update `DEFAULT_SETTINGS` to match. Update the `ExtractionEngineId` import — remove it if no longer used.

**Step 4: Fix test fixtures**

Update `AppSettings` fixtures in `src/lib/db/index.test.ts` and `src/lib/pipeline/orchestrator.test.ts` — remove old fields, add new ones.

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: PASS (may need to fix a few more fixture references)

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts src/lib/db/index.test.ts src/lib/pipeline/orchestrator.test.ts
git commit -m "feat: add modeRole to VisualizationNode, update AppSettings for tiers"
```

---

### Task 2: Extend EntitySpec, ChatMessage, VersionSnapshot

**Files:**
- Modify: `src/lib/3d/entity-spec.ts:43-104`
- Modify: `src/lib/3d/scene-content.types.ts:52-56` (SceneEntitySpec.components)
- Test: `src/lib/3d/entity-spec.test.ts`

**Step 1: Write test for TextComponentSpec**

```typescript
// Add to src/lib/3d/entity-spec.test.ts
it('accepts text component on EntitySpec', () => {
  const entity: EntitySpec = {
    id: 'label-1',
    components: {
      text: {
        text: 'Hello World',
        fontSize: 36,
        color: [1, 1, 1],
        billboard: true,
      },
    },
  };
  expect(entity.components.text?.text).toBe('Hello World');
});

it('accepts tier and messageId on VersionSnapshot', () => {
  const snap: VersionSnapshot = {
    version: 1,
    timestamp: new Date().toISOString(),
    layers: [],
    description: 'Tier 1',
    tier: 1,
    messageId: 'msg-1',
  };
  expect(snap.tier).toBe(1);
  expect(snap.messageId).toBe('msg-1');
});

it('accepts schema on ChatMessage', () => {
  const msg: ChatMessage = {
    id: 'msg-1',
    text: 'test',
    timestamp: new Date().toISOString(),
    layerIds: [],
    schema: {
      type: 'graph',
      title: 'Test',
      description: 'Test schema',
      nodes: [],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    },
  };
  expect(msg.schema?.type).toBe('graph');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/3d/entity-spec.test.ts`
Expected: FAIL — `text` does not exist on components, `tier`/`messageId` don't exist on VersionSnapshot

**Step 3: Implement type changes**

In `src/lib/3d/entity-spec.ts`:

```typescript
// NEW: Add TextComponentSpec interface (before EntitySpec)
export interface TextComponentSpec {
  text: string;
  fontSize?: number;
  color?: [number, number, number];
  background?: [number, number, number];
  backgroundOpacity?: number;
  align?: 'center' | 'left' | 'right';
  billboard?: boolean;
  maxWidth?: number;
}

// Update EntitySpec.components to include text
components: {
  render?: RenderComponentSpec;
  light?: LightComponentSpec;
  text?: TextComponentSpec;
};

// Update VersionSnapshot — add optional fields
interface VersionSnapshot {
  version: number;
  timestamp: string;
  layers: Layer3d[];
  description: string;
  tier?: number;
  messageId?: string;
}

// Update ChatMessage — add optional schema cache
interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  layerIds: string[];
  observationMode?: string;
  schema?: VisualizationSchema;
}
```

Also update `src/lib/3d/scene-content.types.ts` — add `text?: { text: string; [key: string]: unknown }` to `SceneEntitySpec.components`.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/3d/entity-spec.ts src/lib/3d/entity-spec.test.ts src/lib/3d/scene-content.types.ts
git commit -m "feat: add TextComponentSpec, extend VersionSnapshot and ChatMessage"
```

---

### Task 3: Update PipelineStage and ObservationMode types

**Files:**
- Modify: `src/lib/pipeline/types.ts:3-10`
- Modify: `src/lib/3d/observation-modes/types.ts:1-19`
- Test: `src/lib/pipeline/store.test.ts`, `src/lib/3d/observation-modes/registry.test.ts`

**Step 1: Write test for new PipelineStage values**

```typescript
// In src/lib/pipeline/store.test.ts
it('accepts tier-specific stage values', () => {
  pipelineStore.setStage('tier1-extracting');
  // verify via subscribe
});
```

**Step 2: Run test to verify it fails**

**Step 3: Update PipelineStage union**

In `src/lib/pipeline/types.ts`:

```typescript
export type PipelineStage =
  | 'idle'
  | 'tier1-extracting'
  | 'tier1-complete'
  | 'tier2-embedding'
  | 'tier2-clustering'
  | 'tier2-complete'
  | 'tier3-enriching'
  | 'tier3-complete'
  | 'complete'
  | 'interrupted'
  | 'error';
```

**Step 4: Update ObservationMode interface**

In `src/lib/3d/observation-modes/types.ts`:

```typescript
export interface ModeRole {
  id: string;
  label: string;
  description: string;
  prefab: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface ObservationMode {
  id: string;
  name: string;
  description: string;
  roles: ModeRole[];
  prefabs: PrefabDefinition[];
  storyFocus: string;
  render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
}
```

**Step 5: Update graph mode to satisfy new required fields**

In `src/lib/3d/observation-modes/graph.ts`, add `roles`, `prefabs`, and `storyFocus` to the `graphMode` object. Use the existing colors/shapes as prefab definitions. Roles: `core`, `supporting`, `peripheral`, `emergent`.

**Step 6: Fix registry tests and graph tests**

Update mocks in `registry.test.ts` and `graph.test.ts` to include required fields.

**Step 7: Run all tests**

Run: `npx vitest run`

**Step 8: Commit**

```bash
git add src/lib/pipeline/types.ts src/lib/3d/observation-modes/types.ts src/lib/3d/observation-modes/graph.ts src/lib/pipeline/store.test.ts src/lib/3d/observation-modes/registry.test.ts src/lib/3d/observation-modes/graph.test.ts
git commit -m "feat: update PipelineStage for tiers, add ModeRole to ObservationMode"
```

---

## Phase 2: Pipeline Infrastructure

Build the three tiers and the AsyncGenerator runner. Each tier is testable in isolation.

### Task 4: Tier types and runner skeleton

**Files:**
- Create: `src/lib/pipeline/tiers/types.ts`
- Create: `src/lib/pipeline/runner.ts`
- Create: `src/lib/pipeline/runner.test.ts`

**Step 1: Write failing test for the runner**

```typescript
// src/lib/pipeline/runner.test.ts
import { describe, it, expect } from 'vitest';
import { createTieredRunner } from './runner';
import type { VisualizationSchema } from '$lib/types';

const mockSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test',
  description: 'Test',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  metadata: { concepts: ['A'], relationships: [] },
};

describe('createTieredRunner', () => {
  it('yields results for each tier', async () => {
    const tier1 = async () => mockSchema;
    const tier2 = async (s: VisualizationSchema) => ({ ...s, title: 'Refined' });
    const tier3 = null; // LLM not available

    const runner = createTieredRunner({ tier1, tier2, tier3 });
    const results: number[] = [];

    for await (const result of runner.run('test text')) {
      results.push(result.tier);
    }

    expect(results).toEqual([1, 2]);
  });

  it('stops on abort between tiers', async () => {
    const tier1 = async () => mockSchema;
    const tier2 = async (s: VisualizationSchema) => {
      await new Promise(r => setTimeout(r, 100));
      return s;
    };

    const runner = createTieredRunner({ tier1, tier2, tier3: null });
    const results: number[] = [];

    for await (const result of runner.run('test')) {
      results.push(result.tier);
      if (result.tier === 1) runner.abort();
    }

    expect(results).toEqual([1]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/runner.test.ts`

**Step 3: Create tier types**

```typescript
// src/lib/pipeline/tiers/types.ts
import type { VisualizationSchema } from '$lib/types';
import type { PipelineStage } from '../types';

export interface TierContext {
  text: string;
  signal: AbortSignal;
  onStage: (stage: PipelineStage) => void;
}

export type TierFn = (
  schema: VisualizationSchema,
  ctx: TierContext,
) => Promise<VisualizationSchema>;

export interface TierResult {
  tier: number;
  schema: VisualizationSchema;
}
```

**Step 4: Implement runner**

```typescript
// src/lib/pipeline/runner.ts
import type { VisualizationSchema } from '$lib/types';
import type { TierFn, TierResult, TierContext } from './tiers/types';
import type { PipelineStage } from './types';

interface TieredRunnerConfig {
  tier1: TierFn;
  tier2: TierFn | null;
  tier3: TierFn | null;
}

export interface TieredRunner {
  run(text: string, onStage?: (stage: PipelineStage) => void): AsyncGenerator<TierResult>;
  abort(): void;
}

export function createTieredRunner(config: TieredRunnerConfig): TieredRunner {
  let abortController: AbortController | null = null;

  return {
    async *run(text, onStage = () => {}) {
      abortController?.abort();
      abortController = new AbortController();
      const signal = abortController.signal;

      const ctx: TierContext = { text, signal, onStage };

      const emptySchema: VisualizationSchema = {
        type: 'graph',
        title: '',
        description: '',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] },
      };

      // Tier 1 — always runs
      onStage('tier1-extracting');
      const s1 = await config.tier1(emptySchema, ctx);
      if (signal.aborted) return;
      onStage('tier1-complete');
      yield { tier: 1, schema: s1 };

      // Tier 2 — skip if not available or aborted
      if (config.tier2 && !signal.aborted) {
        onStage('tier2-embedding');
        const s2 = await config.tier2(s1, ctx);
        if (signal.aborted) return;
        onStage('tier2-complete');
        yield { tier: 2, schema: s2 };

        // Tier 3 — skip if not available or aborted
        if (config.tier3 && !signal.aborted) {
          onStage('tier3-enriching');
          const s3 = await config.tier3(s2, ctx);
          if (signal.aborted) return;
          onStage('tier3-complete');
          yield { tier: 3, schema: s3 };
        }
      }

      if (!signal.aborted) onStage('complete');
    },

    abort() {
      abortController?.abort();
      abortController = null;
    },
  };
}
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/pipeline/runner.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/pipeline/tiers/types.ts src/lib/pipeline/runner.ts src/lib/pipeline/runner.test.ts
git commit -m "feat: add tiered pipeline runner with abort support"
```

---

### Task 5: Tier 1 — JS Extraction

**Files:**
- Create: `src/lib/pipeline/tiers/tier1-extract.ts`
- Create: `src/lib/pipeline/tiers/tier1-extract.test.ts`

**Step 1: Write failing tests**

Test that Tier 1 produces nodes from keywords and edges from co-occurrence:

```typescript
// src/lib/pipeline/tiers/tier1-extract.test.ts
import { describe, it, expect } from 'vitest';
import { tier1Extract } from './tier1-extract';
import type { TierContext } from './types';

const ctx: TierContext = {
  text: '',
  signal: new AbortController().signal,
  onStage: () => {},
};

describe('tier1Extract', () => {
  it('extracts nodes from keyword-rich text', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data. Data drives machine learning.';
    const schema = await tier1Extract(
      { type: 'graph', title: '', description: '', nodes: [], edges: [], metadata: { concepts: [], relationships: [] } },
      { ...ctx, text },
    );
    expect(schema.nodes.length).toBeGreaterThanOrEqual(2);
    expect(schema.nodes.length).toBeLessThanOrEqual(15);
    expect(schema.nodes.every(n => n.id && n.label)).toBe(true);
    expect(schema.nodes.some(n => typeof n.weight === 'number')).toBe(true);
  });

  it('produces edges from co-occurrence', async () => {
    const text = 'Cats chase mice. Mice eat cheese. Cats and mice live together.';
    const schema = await tier1Extract(
      { type: 'graph', title: '', description: '', nodes: [], edges: [], metadata: { concepts: [], relationships: [] } },
      { ...ctx, text },
    );
    expect(schema.edges.length).toBeGreaterThan(0);
    expect(schema.edges.every(e => e.source && e.target)).toBe(true);
  });

  it('returns empty schema for empty text', async () => {
    const schema = await tier1Extract(
      { type: 'graph', title: '', description: '', nodes: [], edges: [], metadata: { concepts: [], relationships: [] } },
      { ...ctx, text: '' },
    );
    expect(schema.nodes).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement Tier 1**

Extract the core logic from `src/lib/extractors/keywords.ts` (RAKE algorithm) and `src/lib/extractors/nlp.ts` (compromise NLP), combine into `tier1-extract.ts`. Add TF-IDF weighting and co-occurrence edge generation. Incorporate `analyzeText()` from `src/lib/pipeline/analyzer.ts` for viz-type detection.

Key functions to extract:
- RAKE keyword scoring (from `keywords.ts` lines 60-130)
- Compromise NLP noun extraction + SVO patterns (from `nlp.ts` lines 12-80)
- Signal-word analysis (from `analyzer.ts`)
- New: TF-IDF weighting, deduplication, co-occurrence edge builder

The Tier 1 function signature matches `TierFn`: `(schema, ctx) => Promise<VisualizationSchema>`.

**Step 4: Run tests**

Run: `npx vitest run src/lib/pipeline/tiers/tier1-extract.test.ts`

**Step 5: Commit**

```bash
git add src/lib/pipeline/tiers/tier1-extract.ts src/lib/pipeline/tiers/tier1-extract.test.ts
git commit -m "feat: implement Tier 1 JS extraction (RAKE + NLP + TF-IDF)"
```

---

### Task 6: Tier 2 — TF.js Refinement

**Files:**
- Create: `src/lib/pipeline/tiers/tier2-refine.ts`
- Create: `src/lib/pipeline/tiers/tier2-refine.test.ts`

**Step 1: Write failing tests**

Test embedding-based edge refinement and K-means clustering. Use mocked USE model for tests (real model is too large for unit tests):

```typescript
// src/lib/pipeline/tiers/tier2-refine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTier2, cosineSimilarity, kMeansClusters } from './tier2-refine';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });
});

describe('kMeansClusters', () => {
  it('groups similar vectors into clusters', () => {
    const vectors = [
      [1, 0, 0], [0.9, 0.1, 0], // cluster A
      [0, 1, 0], [0.1, 0.9, 0], // cluster B
    ];
    const assignments = kMeansClusters(vectors, 2);
    expect(assignments[0]).toBe(assignments[1]); // same cluster
    expect(assignments[2]).toBe(assignments[3]); // same cluster
    expect(assignments[0]).not.toBe(assignments[2]); // different clusters
  });
});

describe('tier2Refine', () => {
  it('adds theme from clustering to nodes', async () => {
    // Mock USE model
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([[1, 0, 0], [0.9, 0.1, 0], [0, 1, 0]]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema = {
      type: 'graph' as const,
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
        { id: 'c', label: 'Node C' },
      ],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, {
      text: 'A. B. C.',
      signal: new AbortController().signal,
      onStage: () => {},
    });

    expect(result.nodes.every(n => typeof n.theme === 'string')).toBe(true);
  });
});
```

**Step 2: Run tests to verify failure**

**Step 3: Implement Tier 2**

Extract embedding logic from `src/lib/extractors/semantic.ts` (USE model loading, cosine similarity). Add:
- K-means clustering (pure JS, not TF.js — graph sizes too small for GPU benefit)
- Edge refinement (blend co-occurrence with similarity)
- Degree centrality computation
- PCA position hints (using `ml-matrix` or simple power iteration)

Export `cosineSimilarity` and `kMeansClusters` as named exports for unit testing. Use dependency injection for the USE model loader so tests can mock it.

**Step 4: Run tests**

Run: `npx vitest run src/lib/pipeline/tiers/tier2-refine.test.ts`

**Step 5: Commit**

```bash
git add src/lib/pipeline/tiers/tier2-refine.ts src/lib/pipeline/tiers/tier2-refine.test.ts
git commit -m "feat: implement Tier 2 TF.js refinement (embeddings, clustering, PCA)"
```

---

### Task 7: Tier 3 — LLM Micro-Prompts

**Files:**
- Create: `src/lib/pipeline/tiers/tier3-enrich.ts`
- Create: `src/lib/pipeline/tiers/tier3-enrich.test.ts`
- Create: `src/lib/pipeline/tiers/micro-prompts.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/pipeline/tiers/tier3-enrich.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildThemePrompt, buildRolePrompt, buildEdgeLabelPrompt, parseFlatJson } from './micro-prompts';

describe('micro-prompts', () => {
  it('buildThemePrompt produces valid prompt with cluster data', () => {
    const clusters = { 'cluster-0': ['Node A', 'Node B'], 'cluster-1': ['Node C'] };
    const prompt = buildThemePrompt('Test Title', clusters);
    expect(prompt).toContain('cluster-0');
    expect(prompt).toContain('Node A');
    expect(prompt).toContain('JSON');
  });

  it('buildRolePrompt includes mode roles', () => {
    const roles = [
      { id: 'core', label: 'Core', description: 'Main idea' },
      { id: 'supporting', label: 'Supporting', description: 'Detail' },
    ];
    const nodes = ['Node A', 'Node B'];
    const prompt = buildRolePrompt(nodes, roles, 'Classify by importance');
    expect(prompt).toContain('core');
    expect(prompt).toContain('supporting');
  });

  it('parseFlatJson handles valid JSON', () => {
    expect(parseFlatJson('{"a": "hello"}')).toEqual({ a: 'hello' });
  });

  it('parseFlatJson handles markdown-wrapped JSON', () => {
    expect(parseFlatJson('```json\n{"a": "hello"}\n```')).toEqual({ a: 'hello' });
  });

  it('parseFlatJson returns null on invalid input', () => {
    expect(parseFlatJson('not json at all')).toBeNull();
  });
});
```

**Step 2: Run tests to verify failure**

**Step 3: Implement micro-prompts**

`micro-prompts.ts`: Prompt builders for each micro-task + a lenient `parseFlatJson` parser.

`tier3-enrich.ts`: The tier function. Accepts mode roles via the TierContext (extended with `mode?: ObservationMode`). Fires micro-prompts (theme naming, role classification, edge labeling, optional descriptions/summary). Uses `Promise.allSettled` for parallel execution with individual failure tolerance. Requires an LLM client config (endpoint, model) passed through context.

**Step 4: Run tests**

Run: `npx vitest run src/lib/pipeline/tiers/tier3-enrich.test.ts`

**Step 5: Commit**

```bash
git add src/lib/pipeline/tiers/tier3-enrich.ts src/lib/pipeline/tiers/tier3-enrich.test.ts src/lib/pipeline/tiers/micro-prompts.ts
git commit -m "feat: implement Tier 3 LLM micro-prompt enrichment"
```

---

## Phase 3: Text Rendering and Scene Integration

### Task 8: Canvas-to-texture text rendering

**Files:**
- Create: `src/lib/3d/text-renderer.ts`
- Create: `src/lib/3d/text-renderer.test.ts`
- Modify: `src/lib/3d/createScene.ts:164-218` (buildEntity)

**Step 1: Write failing tests for text canvas generation**

```typescript
// src/lib/3d/text-renderer.test.ts
import { describe, it, expect } from 'vitest';
import { createTextCanvas } from './text-renderer';

describe('createTextCanvas', () => {
  it('creates a canvas with text content', () => {
    const canvas = createTextCanvas({
      text: 'Hello World',
      fontSize: 36,
      color: [1, 1, 1],
    });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('applies background when specified', () => {
    const canvas = createTextCanvas({
      text: 'Tablet',
      fontSize: 32,
      color: [0.9, 0.85, 0.7],
      background: [0.15, 0.12, 0.1],
      backgroundOpacity: 1.0,
    });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('word-wraps long text to maxWidth', () => {
    const canvas = createTextCanvas({
      text: 'This is a much longer piece of text that should wrap across multiple lines',
      fontSize: 24,
      maxWidth: 200,
    });
    expect(canvas.height).toBeGreaterThan(30); // multi-line
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement text-renderer.ts**

Pure utility module — takes `TextComponentSpec` options, creates a `<canvas>`, draws text with `ctx.fillText()`, returns the canvas. Handles:
- Font sizing and color (0-1 → 0-255 conversion)
- Optional background fill
- Word wrapping to maxWidth
- Center/left/right alignment

```typescript
// src/lib/3d/text-renderer.ts
import type { TextComponentSpec } from './entity-spec';

export function createTextCanvas(spec: TextComponentSpec): HTMLCanvasElement {
  // Implementation: create canvas, measure text, draw with word wrapping
  // Return canvas ready to be used as pc.Texture source
}
```

**Step 4: Add text branch to createScene.ts buildEntity()**

In `buildEntity()` (around line 168), add:

```typescript
if (spec.components?.text && !spec.components?.render) {
  return buildTextBillboard(app, spec);
}
if (spec.components?.text && spec.components?.render) {
  return buildTexturedEntity(app, spec);
}
```

Implement `buildTextBillboard()`: creates a plane entity with the text canvas as emissiveMap. If `billboard: true`, attaches a per-frame `lookAt(camera)` in the animate callback.

Implement `buildTexturedEntity()`: builds the render entity normally, then applies text canvas as emissiveMap on the material.

**Step 5: Run tests**

Run: `npx vitest run src/lib/3d/text-renderer.test.ts`

**Step 6: Commit**

```bash
git add src/lib/3d/text-renderer.ts src/lib/3d/text-renderer.test.ts src/lib/3d/createScene.ts
git commit -m "feat: add canvas-to-texture text rendering with billboard support"
```

---

### Task 9: Update compositor for text passthrough

**Files:**
- Modify: `src/lib/3d/compositor.ts:186-189`
- Modify: `src/lib/3d/scene-content.types.ts:52-56`
- Test: `src/lib/3d/compositor.test.ts`

**Step 1: Write test for text component passthrough**

```typescript
// Add to src/lib/3d/compositor.test.ts
it('passes through text component to SceneEntitySpec', () => {
  const layer = makeLayer({
    entities: [
      makeEntity({
        id: 'label',
        components: {
          text: { text: 'Hello', billboard: true },
        },
      }),
    ],
  });
  const result = composeLayers([layer], 'test-scene');
  expect(result.entities[0].components?.text).toEqual({ text: 'Hello', billboard: true });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Update types and compositor**

The compositor already passes `components` through at line 188: `spec.components = components as SceneEntitySpec['components']`. The fix is ensuring `SceneEntitySpec.components` type includes `text?`. Update `scene-content.types.ts` line 53-56.

**Step 4: Run tests**

Run: `npx vitest run src/lib/3d/compositor.test.ts`

**Step 5: Commit**

```bash
git add src/lib/3d/compositor.ts src/lib/3d/scene-content.types.ts src/lib/3d/compositor.test.ts
git commit -m "feat: pass text component through compositor to scene"
```

---

## Phase 4: Wire It Up

### Task 10: Update pipeline-bridge for tiered runner

**Files:**
- Modify: `src/lib/3d/pipeline-bridge.ts`
- Modify: `src/lib/3d/pipeline-bridge.test.ts`

**Step 1: Write test for tiered bridge**

```typescript
// Update src/lib/3d/pipeline-bridge.test.ts
it('yields progressive results through tiers', async () => {
  // Test that bridge.process returns an AsyncGenerator
  // Each yield has tier number and layers
});
```

**Step 2: Update bridge to use tiered runner**

The bridge wraps `createTieredRunner` and converts each `TierResult.schema` to `Layer3d[]` via the observation mode renderer. It returns an `AsyncGenerator<{ tier: number; layers: Layer3d[] }>`.

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add src/lib/3d/pipeline-bridge.ts src/lib/3d/pipeline-bridge.test.ts
git commit -m "feat: update pipeline-bridge to use tiered runner"
```

---

### Task 11: StatusBar pipeline stage badge

**Files:**
- Modify: `src/lib/components/3d/StatusBar.svelte`

**Step 1: Add pipelineStage prop and color-coded badge**

Add `pipelineStage?: PipelineStage` to Props. Render a badge between mode and camera labels. Use `$derived` for label, color, and pulse animation based on stage. Clickable when active — `onclick` calls an `onAbort` callback prop.

Color mapping:
- `tier1-*`: amber `#f59e0b`
- `tier2-*`: blue `#3b82f6`
- `tier3-*`: purple `#8b5cf6`
- `complete`: green `#22c55e`
- `interrupted`: orange `#f97316`
- `error`: red `#ef4444`

**Step 2: Commit**

```bash
git add src/lib/components/3d/StatusBar.svelte
git commit -m "feat: add pipeline stage badge to StatusBar"
```

---

### Task 12: Wire +page.svelte for progressive rendering

**Files:**
- Modify: `src/routes/+page.svelte:89-362`

This is the most complex wiring task. Replace `initPipelineBridge()` and `handleChatSubmit()`.

**Step 1: Replace bridge initialization**

Replace the direct extractor-registry-based bridge with `createTieredRunner` + `createPipelineBridge`. Pass tier functions built from the imported tier modules. Pass `pipelineStore.setStage` as `onStage`.

**Step 2: Replace handleChatSubmit with progressive rendering loop**

```typescript
async function handleChatSubmit(text: string) {
  if (!bridge) { showPipelineError('Pipeline not initialized.'); return; }
  isProcessing = true;
  pipelineError = null;
  const messageId = uuid();

  // Pre-message snapshot
  if (storeActiveFileId) {
    await files3dStore.addSnapshot(storeActiveFileId, `Before: ${text.slice(0, 80)}`, 0, messageId);
  }

  try {
    for await (const result of bridge.process(text, activeMode, { theme })) {
      // Assign fractional positions and source provenance
      const plain = plainLayers();
      // Remove any layers from previous tier yield for this message
      const withoutCurrent = plain.filter(l =>
        !(l.source.type === 'chat' && l.source.messageId === messageId)
      );
      let currentLayers = [...withoutCurrent];
      const layerIds: string[] = [];

      for (const layer of result.layers) {
        const positions = currentLayers.map(l => l.position);
        const lastPos = positions.length > 0 ? positions.sort().pop() : undefined;
        layer.position = insertBetween(lastPos, undefined);
        layer.source = { type: 'chat', messageId };
        layerIds.push(layer.id);
        currentLayers = [...currentLayers, layer];
      }

      activeLayers = currentLayers;

      // Tier snapshot
      if (storeActiveFileId) {
        await files3dStore.updateLayers(storeActiveFileId, plainLayers());
        await files3dStore.addSnapshot(storeActiveFileId, `Tier ${result.tier}`, result.tier, messageId);
      }
    }

    // Persist chat message with schema
    if (storeActiveFileId) {
      await files3dStore.addMessage(storeActiveFileId, {
        id: messageId,
        text,
        timestamp: new Date().toISOString(),
        layerIds: activeLayers.filter(l =>
          l.source.type === 'chat' && l.source.messageId === messageId
        ).map(l => l.id),
        observationMode: activeMode,
        // schema cached for mode switching
      });
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Pipeline aborted') {
      pipelineStore.setStage('interrupted');
    } else {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      showPipelineError(msg);
    }
  } finally {
    isProcessing = false;
  }
}
```

**Step 3: Wire StatusBar**

Pass `pipelineStage` from pipelineStore subscription to StatusBar. Pass `onAbort` callback that calls `bridge.abort()`.

**Step 4: Update files3dStore.addSnapshot signature**

Extend `addSnapshot` to accept optional `tier` and `messageId` parameters.

**Step 5: Manual test**

Run `npm run dev`, type text in chat input, verify:
- Tier 1 renders immediately (keyword-based nodes)
- Tier 2 updates after USE loads (refined edges, clusters)
- Tier 3 updates if LLM configured (labels enriched)
- StatusBar shows stage progression
- Click StatusBar badge during processing to abort

**Step 6: Commit**

```bash
git add src/routes/+page.svelte src/lib/stores/files3d.ts
git commit -m "feat: wire progressive tier rendering in page handler"
```

---

## Phase 5: Observation Modes

Each mode follows the same pattern. Build one completely (morality), then the rest in parallel.

### Task 13: Morality mode (template for all modes)

**Files:**
- Create: `src/lib/3d/observation-modes/morality.ts`
- Create: `src/lib/3d/observation-modes/morality.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/3d/observation-modes/morality.test.ts
import { describe, it, expect } from 'vitest';
import { moralityMode } from './morality';

const schema = {
  type: 'graph' as const,
  title: 'Ethics Test',
  description: 'A test of moral concepts',
  nodes: [
    { id: 'a', label: 'Judge', modeRole: 'agent', weight: 0.9 },
    { id: 'b', label: 'Victim', modeRole: 'affected', weight: 0.7 },
    { id: 'c', label: 'Fairness', modeRole: 'value', weight: 0.8 },
  ],
  edges: [
    { source: 'a', target: 'b', label: 'judges', strength: 0.6 },
  ],
  metadata: { concepts: [], relationships: [] },
};

describe('moralityMode', () => {
  it('has correct id and roles', () => {
    expect(moralityMode.id).toBe('morality');
    expect(moralityMode.roles.length).toBe(6);
    expect(moralityMode.roles.map(r => r.id)).toContain('agent');
    expect(moralityMode.roles.map(r => r.id)).toContain('tension');
  });

  it('renders 3+ layers from schema', () => {
    const layers = moralityMode.render(schema, { theme: 'dark' });
    expect(layers.length).toBeGreaterThanOrEqual(3);
  });

  it('uses morality prefabs for entities', () => {
    const layers = moralityMode.render(schema, { theme: 'dark' });
    const concepts = layers.find(l => l.name === 'Concepts');
    expect(concepts).toBeDefined();
    const agentEntity = concepts!.entities.find(e => e.prefab === 'morality:agent');
    expect(agentEntity).toBeDefined();
  });

  it('includes text label children on concept entities', () => {
    const layers = moralityMode.render(schema, { theme: 'dark' });
    const concepts = layers.find(l => l.name === 'Concepts');
    const entity = concepts!.entities[0];
    const labelChild = entity.children?.find(c => c.components.text);
    expect(labelChild).toBeDefined();
    expect(labelChild!.components.text!.text).toBe('Judge');
  });

  it('declares prefabs for all roles', () => {
    expect(moralityMode.prefabs.length).toBe(6);
    const prefabIds = moralityMode.prefabs.map(p => p.id);
    for (const role of moralityMode.roles) {
      expect(prefabIds).toContain(role.prefab);
    }
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement morality mode**

Define the 6 roles, 6 prefabs (with exact colors, shapes, materials, animations from the design agent output), storyFocus string, and the `render()` function. The renderer:
1. Positions tension nodes at center
2. Agents on +X, affected on -X
3. Values radiate upward
4. Duties at mid-height ring
5. Consequences at bottom
6. Creates environment layer (dark walnut ground, arena ring, warm amber light)
7. Creates concepts layer with `prefab: 'morality:{role}'` on each entity
8. Creates connections layer with mode-specific edge colors
9. Adds text label children to all concept entities

**Step 4: Run tests**

Run: `npx vitest run src/lib/3d/observation-modes/morality.test.ts`

**Step 5: Register mode in +page.svelte**

Add `import { moralityMode } from '$lib/3d/observation-modes/morality'` and `modeRegistry.register(moralityMode)` in `initPipelineBridge()`.

**Step 6: Commit**

```bash
git add src/lib/3d/observation-modes/morality.ts src/lib/3d/observation-modes/morality.test.ts src/routes/+page.svelte
git commit -m "feat: add morality observation mode with prefabs and text labels"
```

---

### Task 14-18: Remaining observation modes

Each follows the same pattern as Task 13. These can be done **in parallel** as they have no interdependencies.

**Task 14:** Ontology mode — `ontology.ts` + test. Nested container layout, museum aesthetic.
**Task 15:** Epistemology mode — `epistemology.ts` + test. Concentric torus rings, glass materials.
**Task 16:** Causality mode — `causality.ts` + test. Left-to-right flow, spiral cycles.
**Task 17:** Debate mode — `debate.ts` + test. Blue vs red opposition, arena.
**Task 18:** Appearance mode — `appearance.ts` + test. Two-plane parallax.

Each mode file follows the morality pattern:
1. Define roles (ModeRole[])
2. Define prefabs (PrefabDefinition[]) with exact visual specs
3. Define storyFocus string
4. Implement render() with mode-specific layout
5. Add text label children
6. Register in +page.svelte

One commit per mode.

---

## Phase 6: Cleanup and Migration

### Task 19: Remove old extractors and update DB migration

**Files:**
- Remove: `src/lib/extractors/registry.ts`
- Remove: `src/lib/extractors/types.ts` (remove `ExtractionEngineId`)
- Modify: `src/lib/extractors/llm.ts` (keep for reference but unused by pipeline)
- Modify: `src/lib/extractors/keywords.ts` (logic moved to tier1, can keep as utility)
- Modify: `src/lib/extractors/nlp.ts` (logic moved to tier1, can keep as utility)
- Modify: `src/lib/extractors/semantic.ts` (embedding logic moved to tier2, can keep as utility)
- Modify: `src/lib/db/index.ts` — add migration for settings changes

**Step 1: Add Dexie migration**

In `src/lib/db/index.ts`, add a new version that removes `extractionEngine`, `pipelineMode`, `llmRefinement` from settings and adds `tier2Enabled`, `tier3Enabled`, `llmEnrichmentLevel`, `defaultObservationMode` with defaults.

**Step 2: Remove extractor registry imports from +page.svelte**

Replace all references to `extractorRegistry` and `ExtractionEngineId` with the tiered runner.

**Step 3: Run full test suite**

Run: `npx vitest run`
Fix any remaining references to removed types.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old extractor registry, add DB migration for tier settings"
```

---

### Task 20: Final integration test

**Files:**
- Modify: `src/lib/pipeline/runner.test.ts` (add integration test)

**Step 1: Write end-to-end pipeline test**

Test the full pipeline: Tier 1 → Tier 2 (mocked USE) → Tier 3 (mocked LLM) → graph mode render. Verify the output has nodes with labels, themes, modeRoles, text children, and proper layer structure.

**Step 2: Run full test suite and type check**

```bash
npx vitest run && npm run check
```

**Step 3: Manual smoke test**

Run `npm run dev`:
- Type a paragraph in chat → see progressive rendering
- Verify StatusBar shows stages
- Abort mid-pipeline → verify scene stays at last tier
- Switch observation modes (if UI supports it) → verify re-render
- Undo → verify snapshot restoration

**Step 4: Commit**

```bash
git add -A
git commit -m "test: add end-to-end pipeline integration test"
```

---

## Dependency Graph

```
Phase 1 (Types):
  Task 1 → Task 2 → Task 3

Phase 2 (Pipeline):
  Task 3 → Task 4 → Task 5 → Task 6 → Task 7

Phase 3 (Text + Scene):
  Task 2 → Task 8 → Task 9

Phase 4 (Wiring):
  Task 7 + Task 9 → Task 10 → Task 11 → Task 12

Phase 5 (Modes):
  Task 12 → Task 13 → Tasks 14-18 (parallel)

Phase 6 (Cleanup):
  Task 18 → Task 19 → Task 20
```

Tasks 8-9 (text rendering) can run in parallel with Tasks 5-7 (tiers) since they have no shared dependencies beyond Task 2.
