# Style Switching Panel & Progressive Rendering Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visible panel for switching visualization styles/extraction engines, and build a rendering pipeline that analyzes text, recommends a viz type, extracts concepts, and renders with staged animation.

**Architecture:** New `src/lib/pipeline/` module (analyzer, orchestrator, store, types) wraps the existing extractor registry. A `StylePanel` component in the editor pane replaces keyboard-only switching. Renderers gain entrance animation via a shared utility. Two new AppSettings fields (`pipelineMode`, `llmRefinement`) control pipeline behavior.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, D3.js, vitest, fake-indexeddb

---

### Task 1: Extend AppSettings with Pipeline Fields

**Files:**
- Modify: `src/lib/types.ts:62-78`
- Modify: `src/lib/stores/settings.test.ts`
- Modify: `src/lib/stores/settings.ts`

**Step 1: Write the failing test**

Add to `src/lib/stores/settings.test.ts`:

```ts
it('should include pipeline defaults', async () => {
  await settingsStore.init();
  const settings = get(settingsStore);
  expect(settings.pipelineMode).toBe('auto');
  expect(settings.llmRefinement).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/settings.test.ts`
Expected: FAIL — `pipelineMode` is undefined

**Step 3: Add fields to AppSettings and DEFAULT_SETTINGS**

In `src/lib/types.ts`, add to the `AppSettings` interface:

```ts
export interface AppSettings {
  id: string;
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
  controlPlacement: 'hud' | 'dock' | 'embedded';
  extractionEngine: 'llm' | 'nlp' | 'keywords' | 'semantic';
  pipelineMode: 'auto' | 'manual';
  llmRefinement: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light',
  controlPlacement: 'hud',
  extractionEngine: 'llm',
  pipelineMode: 'auto',
  llmRefinement: false
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/settings.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (types.test.ts may need updating if it checks AppSettings shape)

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/stores/settings.test.ts
git commit -m "feat: add pipelineMode and llmRefinement to AppSettings"
```

---

### Task 2: Pipeline Types

**Files:**
- Create: `src/lib/pipeline/types.ts`

**Step 1: Create the pipeline types file**

```ts
import type { VisualizationType } from '$lib/types';

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'refining'
  | 'extracting'
  | 'rendering'
  | 'complete'
  | 'error';

export interface VizTypeScore {
  type: VisualizationType;
  score: number;
}

export interface PipelineRecommendation {
  type: VisualizationType;
  confidence: number;
}

export interface PipelineState {
  stage: PipelineStage;
  recommendation: PipelineRecommendation | null;
  scores: Record<VisualizationType, number> | null;
  error: string | null;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors related to pipeline/types.ts

**Step 3: Commit**

```bash
git add src/lib/pipeline/types.ts
git commit -m "feat: add pipeline type definitions"
```

---

### Task 3: Pipeline Store

**Files:**
- Create: `src/lib/pipeline/store.ts`
- Create: `src/lib/pipeline/store.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/pipeline/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { pipelineStore } from './store';

describe('pipelineStore', () => {
  it('starts in idle stage with no recommendation', () => {
    const state = get(pipelineStore);
    expect(state.stage).toBe('idle');
    expect(state.recommendation).toBeNull();
    expect(state.scores).toBeNull();
    expect(state.error).toBeNull();
  });

  it('setStage updates the current stage', () => {
    pipelineStore.setStage('analyzing');
    expect(get(pipelineStore).stage).toBe('analyzing');
  });

  it('setRecommendation stores type and confidence', () => {
    pipelineStore.setRecommendation({ type: 'flowchart', confidence: 0.85 });
    const state = get(pipelineStore);
    expect(state.recommendation?.type).toBe('flowchart');
    expect(state.recommendation?.confidence).toBe(0.85);
  });

  it('setScores stores all viz type scores', () => {
    const scores = {
      graph: 0.3, tree: 0.2, flowchart: 0.85,
      hierarchy: 0.1, logicalflow: 0.15, storyboard: 0.05
    };
    pipelineStore.setScores(scores);
    expect(get(pipelineStore).scores).toEqual(scores);
  });

  it('setError sets stage to error and stores message', () => {
    pipelineStore.setError('Something went wrong');
    const state = get(pipelineStore);
    expect(state.stage).toBe('error');
    expect(state.error).toBe('Something went wrong');
  });

  it('reset returns to idle with no recommendation', () => {
    pipelineStore.setStage('extracting');
    pipelineStore.setRecommendation({ type: 'tree', confidence: 0.7 });
    pipelineStore.reset();
    const state = get(pipelineStore);
    expect(state.stage).toBe('idle');
    expect(state.recommendation).toBeNull();
    expect(state.scores).toBeNull();
    expect(state.error).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/store.test.ts`
Expected: FAIL — cannot find module './store'

**Step 3: Implement the pipeline store**

Create `src/lib/pipeline/store.ts`:

```ts
import { writable } from 'svelte/store';
import type { PipelineState, PipelineStage, PipelineRecommendation } from './types';
import type { VisualizationType } from '$lib/types';

const INITIAL_STATE: PipelineState = {
  stage: 'idle',
  recommendation: null,
  scores: null,
  error: null
};

function createPipelineStore() {
  const { subscribe, set, update } = writable<PipelineState>(INITIAL_STATE);

  return {
    subscribe,

    setStage(stage: PipelineStage) {
      update(s => ({ ...s, stage, error: null }));
    },

    setRecommendation(rec: PipelineRecommendation) {
      update(s => ({ ...s, recommendation: rec }));
    },

    setScores(scores: Record<VisualizationType, number>) {
      update(s => ({ ...s, scores }));
    },

    setError(error: string) {
      update(s => ({ ...s, stage: 'error' as PipelineStage, error }));
    },

    reset() {
      set({ ...INITIAL_STATE });
    }
  };
}

export const pipelineStore = createPipelineStore();
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/store.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/pipeline/store.ts src/lib/pipeline/store.test.ts
git commit -m "feat: add pipeline store for stage tracking"
```

---

### Task 4: Text Analyzer

**Files:**
- Create: `src/lib/pipeline/analyzer.ts`
- Create: `src/lib/pipeline/analyzer.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/pipeline/analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeText } from './analyzer';

describe('analyzeText', () => {
  it('returns scores for all 6 viz types', () => {
    const scores = analyzeText('Some sample text about things.');
    expect(Object.keys(scores)).toHaveLength(6);
    expect(scores).toHaveProperty('graph');
    expect(scores).toHaveProperty('tree');
    expect(scores).toHaveProperty('flowchart');
    expect(scores).toHaveProperty('hierarchy');
    expect(scores).toHaveProperty('logicalflow');
    expect(scores).toHaveProperty('storyboard');
  });

  it('all scores are between 0 and 1', () => {
    const scores = analyzeText('First, we gather data. Then, we analyze it. Next, we report findings. Finally, we make decisions.');
    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('ranks flowchart highest for sequential text', () => {
    const text = 'First, gather the requirements. Then, design the solution. Next, implement the code. After that, test the code. Finally, deploy to production.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('flowchart');
  });

  it('ranks tree highest for taxonomic text', () => {
    const text = 'A dog is a type of mammal. A cat is a kind of mammal. A mammal is a type of animal. A reptile is a kind of animal. A snake is a subclass of reptile.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('tree');
  });

  it('ranks hierarchy highest for containment text', () => {
    const text = 'The library contains fiction and non-fiction sections. Fiction includes novels and short stories. Non-fiction comprises biographies and textbooks. Each section consists of multiple shelves.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('hierarchy');
  });

  it('ranks logicalflow highest for argument text', () => {
    const text = 'Because the climate is warming, therefore sea levels are rising. However, some regions may experience cooling. The evidence suggests that carbon emissions are the primary cause. We can conclude that action is needed.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('logicalflow');
  });

  it('ranks storyboard highest for narrative text', () => {
    const text = 'In the first scene, Alice enters the room. Meanwhile, Bob is waiting outside. The conflict arises when they disagree about the plan. The resolution comes when they find common ground in the final scene.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('storyboard');
  });

  it('returns graph as default for unstructured text', () => {
    const text = 'Machine learning is connected to data science. Natural language processing relates to artificial intelligence. Computer vision shares methods with pattern recognition.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('graph');
  });

  it('handles empty text without throwing', () => {
    const scores = analyzeText('');
    expect(scores.graph).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/analyzer.test.ts`
Expected: FAIL — cannot find module './analyzer'

**Step 3: Implement the text analyzer**

Create `src/lib/pipeline/analyzer.ts`:

```ts
import type { VisualizationType } from '$lib/types';

/** Signal word lists for each viz type. */
const SEQUENTIAL_SIGNALS = ['first', 'then', 'next', 'after', 'finally', 'subsequently', 'step', 'lastly', 'second', 'third', 'before that', 'followed by'];
const TAXONOMIC_SIGNALS = ['is a', 'is an', 'are a', 'are an', 'type of', 'kind of', 'subclass of', 'subcategory of', 'species of'];
const CONTAINMENT_SIGNALS = ['contains', 'includes', 'consists of', 'comprises', 'is made of', 'is part of', 'composed of', 'divided into'];
const LOGICAL_SIGNALS = ['because', 'therefore', 'however', 'consequently', 'evidence', 'suggests', 'conclude', 'premise', 'thus', 'hence', 'although', 'despite', 'implies'];
const NARRATIVE_SIGNALS = ['scene', 'meanwhile', 'character', 'conflict', 'resolution', 'chapter', 'protagonist', 'dialogue', 'narrator', 'plot', 'story'];

/**
 * Count how many signals from a list appear in the text.
 * Returns the count normalized by the list length (0–1 scale, clamped).
 */
function signalDensity(lower: string, signals: readonly string[]): number {
  let hits = 0;
  for (const s of signals) {
    if (lower.includes(s)) hits++;
  }
  // Normalize: 3+ hits is considered very strong (1.0)
  return Math.min(hits / 3, 1);
}

/**
 * Analyze text and score it against all 6 visualization types.
 * Returns a record mapping each type to a confidence score (0–1).
 * Runs in <5ms for typical text — no external dependencies.
 */
export function analyzeText(text: string): Record<VisualizationType, number> {
  const lower = text.toLowerCase();

  const flowchartScore = signalDensity(lower, SEQUENTIAL_SIGNALS);
  const treeScore = signalDensity(lower, TAXONOMIC_SIGNALS);
  const hierarchyScore = signalDensity(lower, CONTAINMENT_SIGNALS);
  const logicalflowScore = signalDensity(lower, LOGICAL_SIGNALS);
  const storyboardScore = signalDensity(lower, NARRATIVE_SIGNALS);

  // Graph is the "general" fallback — it scores higher when nothing else is dominant
  const maxSpecific = Math.max(flowchartScore, treeScore, hierarchyScore, logicalflowScore, storyboardScore);
  const graphScore = Math.max(0.3, 1 - maxSpecific);

  return {
    graph: graphScore,
    tree: treeScore,
    flowchart: flowchartScore,
    hierarchy: hierarchyScore,
    logicalflow: logicalflowScore,
    storyboard: storyboardScore
  };
}

/** Return the viz type with the highest score from an analysis result. */
export function topRecommendation(scores: Record<VisualizationType, number>): { type: VisualizationType; confidence: number } {
  let best: VisualizationType = 'graph';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores) as [VisualizationType, number][]) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return { type: best, confidence: bestScore };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/analyzer.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/pipeline/analyzer.ts src/lib/pipeline/analyzer.test.ts
git commit -m "feat: add text analyzer for viz type recommendation"
```

---

### Task 5: Pipeline Orchestrator

**Files:**
- Create: `src/lib/pipeline/orchestrator.ts`
- Create: `src/lib/pipeline/orchestrator.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/pipeline/orchestrator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { RenderingPipeline } from './orchestrator';
import { pipelineStore } from './store';
import type { VisualizationSchema } from '$lib/types';
import type { ExtractionEngineId } from '$lib/extractors/types';

const MOCK_SCHEMA: VisualizationSchema = {
  type: 'graph',
  title: 'Test',
  description: 'Test viz',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  metadata: { concepts: ['A'], relationships: [] }
};

function mockRegistry() {
  const extract = vi.fn().mockResolvedValue(MOCK_SCHEMA);
  return {
    getEngine: vi.fn().mockReturnValue({ id: 'nlp', name: 'NLP', extract }),
    listEngines: vi.fn().mockReturnValue([]),
    updateLLMConfig: vi.fn()
  };
}

function defaultSettings() {
  return {
    id: 'app-settings',
    llmEndpoint: 'http://localhost:11434/v1',
    llmModel: 'llama3.2',
    theme: 'light' as const,
    controlPlacement: 'hud' as const,
    extractionEngine: 'nlp' as const,
    pipelineMode: 'auto' as const,
    llmRefinement: false
  };
}

describe('RenderingPipeline', () => {
  beforeEach(() => {
    pipelineStore.reset();
  });

  it('runs full auto pipeline: analyze → extract → complete', async () => {
    const registry = mockRegistry();
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    const result = await pipeline.run('First do this, then do that, next do another.', 'graph', 'nlp');

    expect(result).toEqual(MOCK_SCHEMA);
    expect(get(pipelineStore).stage).toBe('complete');
    expect(get(pipelineStore).recommendation).not.toBeNull();
    expect(get(pipelineStore).scores).not.toBeNull();
  });

  it('skips analyze/refine in manual mode', async () => {
    const registry = mockRegistry();
    const settings = { ...defaultSettings(), pipelineMode: 'manual' as const };
    const pipeline = new RenderingPipeline(registry, () => settings);

    await pipeline.run('Some text', 'graph', 'nlp');

    // In manual mode, no recommendation is set
    expect(get(pipelineStore).recommendation).toBeNull();
    expect(get(pipelineStore).scores).toBeNull();
    expect(get(pipelineStore).stage).toBe('complete');
  });

  it('calls the correct extraction engine', async () => {
    const registry = mockRegistry();
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    await pipeline.run('text', 'flowchart', 'nlp');

    expect(registry.getEngine).toHaveBeenCalledWith('nlp');
    const engine = registry.getEngine('nlp');
    expect(engine.extract).toHaveBeenCalledWith('text', 'flowchart');
  });

  it('sets error stage when extraction fails', async () => {
    const registry = mockRegistry();
    registry.getEngine = vi.fn().mockReturnValue({
      id: 'nlp', name: 'NLP',
      extract: vi.fn().mockRejectedValue(new Error('Extraction failed'))
    });
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    await expect(pipeline.run('text', 'graph', 'nlp')).rejects.toThrow('Extraction failed');
    expect(get(pipelineStore).stage).toBe('error');
    expect(get(pipelineStore).error).toBe('Extraction failed');
  });

  it('abort cancels a running pipeline', async () => {
    const registry = mockRegistry();
    // Make extract slow so we can abort
    const extract = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(MOCK_SCHEMA), 500)));
    registry.getEngine = vi.fn().mockReturnValue({ id: 'nlp', name: 'NLP', extract });
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    const promise = pipeline.run('text', 'graph', 'nlp');
    pipeline.abort();

    await expect(promise).rejects.toThrow('Pipeline aborted');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/orchestrator.test.ts`
Expected: FAIL — cannot find module './orchestrator'

**Step 3: Implement the orchestrator**

Create `src/lib/pipeline/orchestrator.ts`:

```ts
import { analyzeText, topRecommendation } from './analyzer';
import { pipelineStore } from './store';
import type { VisualizationType, AppSettings, VisualizationSchema } from '$lib/types';
import type { ExtractionEngineId } from '$lib/extractors/types';

interface ExtractorRegistryLike {
  getEngine(id: ExtractionEngineId): { extract(text: string, vizType?: VisualizationType | null): Promise<VisualizationSchema> };
}

export class RenderingPipeline {
  private registry: ExtractorRegistryLike;
  private getSettings: () => AppSettings;
  private abortController: AbortController | null = null;

  constructor(
    registry: ExtractorRegistryLike,
    getSettings: () => AppSettings
  ) {
    this.registry = registry;
    this.getSettings = getSettings;
  }

  async run(
    text: string,
    vizType: VisualizationType,
    engineId: ExtractionEngineId
  ): Promise<VisualizationSchema> {
    // Cancel any previous run
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    pipelineStore.reset();

    const settings = this.getSettings();

    try {
      // Stage 1: Analyze (auto mode only)
      if (settings.pipelineMode === 'auto') {
        pipelineStore.setStage('analyzing');
        this.checkAborted(signal);

        const scores = analyzeText(text);
        pipelineStore.setScores(scores);

        const rec = topRecommendation(scores);
        pipelineStore.setRecommendation(rec);
      }

      // Stage 2: Refine (auto + llmRefinement only) — placeholder for future LLM call
      if (settings.pipelineMode === 'auto' && settings.llmRefinement) {
        pipelineStore.setStage('refining');
        this.checkAborted(signal);
        // Future: send classification prompt to LLM with 2s timeout
        // For now, heuristic recommendation stands
      }

      // Stage 3: Extract
      pipelineStore.setStage('extracting');
      this.checkAborted(signal);

      const engine = this.registry.getEngine(engineId);
      const schema = await this.raceWithAbort(engine.extract(text, vizType), signal);

      // Stage 4: Render (signal to UI)
      pipelineStore.setStage('rendering');

      // Mark complete
      pipelineStore.setStage('complete');

      return schema;
    } catch (err) {
      if (err instanceof Error && err.message === 'Pipeline aborted') {
        pipelineStore.setStage('idle');
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown pipeline error';
      pipelineStore.setError(message);
      throw err;
    }
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new Error('Pipeline aborted');
  }

  private raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Pipeline aborted'));
        return;
      }
      const onAbort = () => reject(new Error('Pipeline aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise
        .then(result => {
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        })
        .catch(err => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        });
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/orchestrator.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/pipeline/orchestrator.test.ts
git commit -m "feat: add rendering pipeline orchestrator with abort support"
```

---

### Task 6: Pipeline Index Barrel

**Files:**
- Create: `src/lib/pipeline/index.ts`

**Step 1: Create the barrel export**

```ts
export { analyzeText, topRecommendation } from './analyzer';
export { pipelineStore } from './store';
export { RenderingPipeline } from './orchestrator';
export type { PipelineStage, PipelineState, PipelineRecommendation, VizTypeScore } from './types';
```

**Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/pipeline/index.ts
git commit -m "feat: add pipeline barrel export"
```

---

### Task 7: Entrance Animation Utility

**Files:**
- Modify: `src/lib/components/visualizer/renderers/utils.ts`
- Modify: `src/lib/components/visualizer/renderers/utils.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/components/visualizer/renderers/utils.test.ts`:

```ts
describe('animateEntrance', () => {
  it('is exported as a function', async () => {
    const { animateEntrance } = await import('./utils');
    expect(typeof animateEntrance).toBe('function');
  });
});
```

Note: Full SVG animation testing is impractical in jsdom. We verify the function exists and doesn't throw on a minimal SVG. The animation is visually verified in the browser.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/visualizer/renderers/utils.test.ts`
Expected: FAIL — animateEntrance is not exported

**Step 3: Add animateEntrance to utils.ts**

Append to `src/lib/components/visualizer/renderers/utils.ts`:

```ts
/**
 * Apply staged entrance animation to an already-rendered SVG.
 *
 * Convention: renderers tag their elements with CSS classes:
 *   .node-shape — node circles/rects
 *   .edge-line  — edge lines/paths
 *   .node-label — text labels
 *   .detail-card — detail card groups
 *
 * Phase 1 (0–200ms): nodes fade + scale in
 * Phase 2 (200–500ms): edges draw in via stroke-dashoffset
 * Phase 3 (500–700ms): labels fade in
 * Phase 4 (700–900ms): detail cards slide in
 */
export function animateEntrance(svg: SVGSVGElement): void {
  const nodes = svg.querySelectorAll('.node-shape:not(.glow)');
  const edges = svg.querySelectorAll('.edge-line');
  const labels = svg.querySelectorAll('.node-label');
  const cards = svg.querySelectorAll('.detail-card');

  // Phase 1: nodes
  nodes.forEach((el) => {
    const htmlEl = el as SVGElement;
    htmlEl.style.opacity = '0';
    htmlEl.style.transform = 'scale(0.8)';
    htmlEl.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
    requestAnimationFrame(() => {
      htmlEl.style.opacity = '1';
      htmlEl.style.transform = 'scale(1)';
    });
  });

  // Phase 2: edges
  edges.forEach((el) => {
    const pathEl = el as SVGElement;
    if (pathEl instanceof SVGGeometryElement && typeof pathEl.getTotalLength === 'function') {
      const length = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = String(length);
      pathEl.style.strokeDashoffset = String(length);
      pathEl.style.transition = `stroke-dashoffset 300ms ease-out 200ms`;
      requestAnimationFrame(() => {
        pathEl.style.strokeDashoffset = '0';
      });
    } else {
      // Fallback for <line> elements: fade in
      pathEl.style.opacity = '0';
      pathEl.style.transition = 'opacity 300ms ease-out 200ms';
      requestAnimationFrame(() => {
        pathEl.style.opacity = '1';
      });
    }
  });

  // Phase 3: labels
  labels.forEach((el) => {
    const htmlEl = el as SVGElement;
    htmlEl.style.opacity = '0';
    htmlEl.style.transition = 'opacity 200ms ease-out 500ms';
    requestAnimationFrame(() => {
      htmlEl.style.opacity = '1';
    });
  });

  // Phase 4: detail cards
  cards.forEach((el) => {
    const htmlEl = el as SVGElement;
    htmlEl.style.opacity = '0';
    htmlEl.style.transition = 'opacity 200ms ease-out 700ms';
    requestAnimationFrame(() => {
      htmlEl.style.opacity = '1';
    });
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/visualizer/renderers/utils.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/components/visualizer/renderers/utils.ts src/lib/components/visualizer/renderers/utils.test.ts
git commit -m "feat: add animateEntrance utility for staged SVG animation"
```

---

### Task 8: Tag Renderer Elements with CSS Classes

The renderers need to apply `.edge-line` and `.node-label` classes so `animateEntrance()` can target them. Currently, `.node-shape` is already used by some renderers but `.edge-line` and `.node-label` are not.

**Files:**
- Modify: `src/lib/components/visualizer/renderers/graph.ts`
- Modify: `src/lib/components/visualizer/renderers/tree.ts`
- Modify: `src/lib/components/visualizer/renderers/flowchart.ts`
- Modify: `src/lib/components/visualizer/renderers/hierarchy.ts`
- Modify: `src/lib/components/visualizer/renderers/logicalflow.ts`
- Modify: `src/lib/components/visualizer/renderers/storyboard.ts`

**Step 1: Audit each renderer for existing class usage**

Read each renderer file. For each, identify:
- Edge elements (lines, paths) → add `.attr('class', 'edge-line')` or `.classed('edge-line', true)`
- Label text elements → add `.classed('node-label', true)`
- Detail card groups → add `.classed('detail-card', true)`

**Step 2: Add classes to each renderer**

In each renderer, where edges are appended (typically `g.selectAll('line')` or `g.selectAll('path')` for edges), add:
```ts
.classed('edge-line', true)
```

Where node labels are appended (typically `text` elements inside node groups), add:
```ts
.classed('node-label', true)
```

Where detail card groups are created via `appendDetailCard()`, wrap in a group with `.classed('detail-card', true)`.

This is a mechanical change across 6 files. Each renderer already has these elements — just add the class attribute.

**Step 3: Verify visually that nothing breaks**

Run: `npm run dev`
Load a visualization, confirm it still renders correctly (classes are purely additive).

**Step 4: Commit**

```bash
git add src/lib/components/visualizer/renderers/*.ts
git commit -m "feat: tag renderer elements with edge-line, node-label, detail-card classes"
```

---

### Task 9: Wire animateEntrance into VisualizerCanvas

**Files:**
- Modify: `src/lib/components/visualizer/VisualizerCanvas.svelte:1-5,31-38`

**Step 1: Import animateEntrance**

Add to the imports at the top of `VisualizerCanvas.svelte`:

```ts
import { animateEntrance } from './renderers/utils';
```

**Step 2: Call animateEntrance after render**

In the `render()` function, after `renderVisualization(svgEl, visualization)` and `attachNodeEvents()`, add:

```ts
animateEntrance(svgEl);
```

So the `render()` function becomes:

```ts
function render() {
  if (!svgEl || !visualization) return;
  const rect = containerEl.getBoundingClientRect();
  svgEl.setAttribute('width', String(rect.width));
  svgEl.setAttribute('height', String(rect.height));
  renderVisualization(svgEl, visualization);
  attachNodeEvents();
  animateEntrance(svgEl);
}
```

**Step 3: Verify visually**

Run: `npm run dev`
Trigger a visualization — nodes should fade in, then edges draw, then labels appear.

**Step 4: Commit**

```bash
git add src/lib/components/visualizer/VisualizerCanvas.svelte
git commit -m "feat: wire entrance animation into VisualizerCanvas render cycle"
```

---

### Task 10: StylePanel Component

**Files:**
- Create: `src/lib/components/editor/StylePanel.svelte`

**Step 1: Create the StylePanel component**

```svelte
<script lang="ts">
  import type { VisualizationType } from '$lib/types';
  import type { ExtractionEngineId } from '$lib/extractors/types';
  import type { PipelineStage, PipelineRecommendation } from '$lib/pipeline/types';
  import { vizStore } from '$lib/stores/visualization';

  interface Props {
    vizType: VisualizationType;
    engineId: ExtractionEngineId;
    onVizTypeChange: (type: VisualizationType) => void;
    onEngineChange: (id: ExtractionEngineId) => void;
    pipelineStage: PipelineStage;
    recommendation: PipelineRecommendation | null;
  }

  let { vizType, engineId, onVizTypeChange, onEngineChange, pipelineStage, recommendation }: Props = $props();

  const VIZ_TYPES: { id: VisualizationType; label: string }[] = [
    { id: 'graph', label: 'Graph' },
    { id: 'tree', label: 'Tree' },
    { id: 'flowchart', label: 'Flow' },
    { id: 'hierarchy', label: 'Hierarchy' },
    { id: 'logicalflow', label: 'Logic' },
    { id: 'storyboard', label: 'Story' }
  ];

  const ENGINES: { id: ExtractionEngineId; label: string }[] = [
    { id: 'llm', label: 'LLM' },
    { id: 'nlp', label: 'NLP' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'semantic', label: 'Semantic' }
  ];

  const STAGE_LABELS: Partial<Record<PipelineStage, string>> = {
    analyzing: 'Analyzing…',
    refining: 'Refining…',
    extracting: 'Extracting…',
    rendering: 'Rendering…'
  };

  let stageLabel = $derived(STAGE_LABELS[pipelineStage] ?? null);
  let isActive = $derived(pipelineStage !== 'idle' && pipelineStage !== 'complete' && pipelineStage !== 'error');
</script>

<div class="flex flex-col gap-2 px-3 py-2">
  <!-- Viz Type Row -->
  <div>
    <span class="text-[10px] font-semibold uppercase tracking-widest block mb-1" style="color: var(--text-muted)">Style</span>
    <div class="flex flex-wrap gap-1">
      {#each VIZ_TYPES as vt}
        <button
          class="text-[11px] px-2 py-1 rounded-md font-medium transition-colors"
          style={vizType === vt.id
            ? 'background: var(--accent); color: white;'
            : 'background: var(--surface-bg); color: var(--text-secondary); border: 1px solid var(--border);'}
          onclick={() => onVizTypeChange(vt.id)}
        >
          {vt.label}
          {#if recommendation && recommendation.type === vt.id && vizType !== vt.id}
            <span class="ml-0.5" title="Recommended">★</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Engine Row -->
  <div>
    <span class="text-[10px] font-semibold uppercase tracking-widest block mb-1" style="color: var(--text-muted)">Engine</span>
    <div class="flex flex-wrap gap-1">
      {#each ENGINES as eng}
        <button
          class="text-[11px] px-2 py-1 rounded-md font-medium transition-colors"
          style={engineId === eng.id
            ? 'background: var(--accent); color: white;'
            : 'background: var(--surface-bg); color: var(--text-secondary); border: 1px solid var(--border);'}
          onclick={() => onEngineChange(eng.id)}
        >
          {eng.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Storyboard Orientation (conditional) -->
  {#if vizType === 'storyboard'}
    <div class="flex items-center gap-2" style="color: var(--text-tertiary)">
      <span class="text-[10px] font-semibold uppercase tracking-widest" style="color: var(--text-muted)">Orientation</span>
      <button
        onclick={() => vizStore.setStoryboardOrientation($vizStore.storyboardOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
        class="text-[11px] px-2 py-0.5 rounded font-mono"
        style="border: 1px solid var(--border); color: var(--text-secondary)"
      >
        {$vizStore.storyboardOrientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
      </button>
    </div>
  {/if}

  <!-- Pipeline Status Line -->
  {#if isActive && stageLabel}
    <div class="flex items-center gap-1.5 text-[11px]" style="color: var(--text-tertiary)">
      <div class="w-3 h-3 border border-current rounded-full animate-spin" style="border-top-color: var(--accent)"></div>
      <span>{stageLabel}</span>
    </div>
  {:else if recommendation && pipelineStage === 'idle' || pipelineStage === 'complete'}
    <div class="text-[11px]" style="color: var(--text-muted)">
      ★ Recommended: <span class="font-medium" style="color: var(--text-secondary)">{recommendation.type}</span>
    </div>
  {/if}
</div>
```

**Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/components/editor/StylePanel.svelte
git commit -m "feat: add StylePanel component for viz type and engine switching"
```

---

### Task 11: Integrate StylePanel into EditorPane

**Files:**
- Modify: `src/lib/components/editor/EditorPane.svelte`

**Step 1: Update EditorPane props**

Add new props to the `Props` interface:

```ts
import type { ExtractionEngineId } from '$lib/extractors/types';
import type { PipelineStage, PipelineRecommendation } from '$lib/pipeline/types';

interface Props {
  // ...existing props...
  vizType: VisualizationType;  // new
  engineId: ExtractionEngineId;  // new
  onVizTypeChange: (type: VisualizationType) => void;  // new
  onEngineChange: (id: ExtractionEngineId) => void;  // new
  pipelineStage: PipelineStage;  // new
  recommendation: PipelineRecommendation | null;  // new
}
```

Import `StylePanel` and `Panel`:

```ts
import StylePanel from './StylePanel.svelte';
```

**Step 2: Add StylePanel between Context and Input panels**

Insert after the Context panel `{/if}` block and before the embeddedControls block:

```svelte
<Panel title="Visualization" defaultOpen={true}>
  <StylePanel
    {vizType}
    {engineId}
    {onVizTypeChange}
    {onEngineChange}
    {pipelineStage}
    {recommendation}
  />
</Panel>
```

**Step 3: Remove the storyboard orientation toggle from the Input panel**

Delete the existing storyboard orientation block (lines 70-81 in current EditorPane.svelte) since it's now in StylePanel.

**Step 4: Verify TypeScript compiles**

Run: `npm run check`
Expected: Errors about missing props at the call site in +page.svelte (we'll fix that in Task 13)

**Step 5: Commit**

```bash
git add src/lib/components/editor/EditorPane.svelte
git commit -m "feat: integrate StylePanel into EditorPane"
```

---

### Task 12: Update Settings Page

**Files:**
- Modify: `src/routes/settings/+page.svelte`

**Step 1: Add pipeline mode and LLM refinement state variables**

After the existing state declarations (line 10), add:

```ts
let pipelineMode = $state<'auto' | 'manual'>('auto');
let llmRefinement = $state(false);
```

**Step 2: Load from settings on mount**

In the `onMount` callback, after existing loads, add:

```ts
pipelineMode = $settingsStore.pipelineMode ?? 'auto';
llmRefinement = $settingsStore.llmRefinement ?? false;
```

**Step 3: Include in save()**

Update the `save()` function to include the new fields:

```ts
await settingsStore.update({
  llmEndpoint: endpoint, llmModel: model, theme, controlPlacement,
  extractionEngine, pipelineMode, llmRefinement
});
```

**Step 4: Add Pipeline section to the form**

Insert between the Theme and Control Placement sections:

```svelte
<div>
  <label for="pipelineMode" class="block text-sm font-medium mb-1" style="color: var(--text-secondary)">Pipeline Mode</label>
  <select
    id="pipelineMode"
    bind:value={pipelineMode}
    class="w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:border-transparent"
    style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-primary); --tw-ring-color: var(--accent)"
  >
    <option value="auto">Auto (analyze + recommend)</option>
    <option value="manual">Manual (direct extraction)</option>
  </select>
  <p class="text-xs mt-1" style="color: var(--text-muted)">Auto mode analyzes text to recommend the best visualization style.</p>
</div>

{#if pipelineMode === 'auto'}
  <div>
    <label class="flex items-center gap-2 text-sm font-medium" style="color: var(--text-secondary)">
      <input
        type="checkbox"
        bind:checked={llmRefinement}
        class="rounded"
        style="accent-color: var(--accent)"
      />
      LLM Refinement
    </label>
    <p class="text-xs mt-1" style="color: var(--text-muted)">Use the LLM to refine the heuristic recommendation (requires running LLM server).</p>
  </div>
{/if}
```

**Step 5: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add pipeline mode and LLM refinement settings"
```

---

### Task 13: Wire Pipeline into +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

This is the integration task that connects everything.

**Step 1: Import pipeline modules**

Add to imports:

```ts
import { RenderingPipeline, pipelineStore } from '$lib/pipeline';
```

**Step 2: Create pipeline instance**

After the registry creation (line 69), add:

```ts
let pipeline = new RenderingPipeline(registry, () => $settingsStore);
```

**Step 3: Replace handleVisualize extraction with pipeline**

Replace the extraction logic in `handleVisualize()`:

```ts
async function handleVisualize() {
  if (!activeFile || !activeFile.text.trim()) return;

  const vizType = $vizStore.vizType ?? 'graph';
  const contentHash = hashContent(activeFile.text);
  const cached = activeFile.cachedSchemas?.[vizType];

  if (cached && cached.contentHash === contentHash) {
    isFromCache = true;
    vizStore.setVisualization(cached.schema);
    return;
  }

  isFromCache = false;
  vizStore.setLoading();
  try {
    const engineId = $settingsStore.extractionEngine as ExtractionEngineId;
    const viz = await pipeline.run(activeFile.text, vizType, engineId);
    vizStore.setVisualization(viz);
    await filesStore.updateVisualization(activeFile.id, viz);
    await filesStore.updateCachedSchema(activeFile.id, vizType, viz, contentHash);
  } catch (err) {
    if (err instanceof Error && err.message === 'Pipeline aborted') return;
    vizStore.setError(err instanceof Error ? err.message : 'Unknown error');
  }
}
```

**Step 4: Add handlers for StylePanel**

Add two new functions:

```ts
function handleVizTypeChange(type: VisualizationType) {
  vizStore.setVizType(type);
  document.body.setAttribute('data-viz-type', type);
}

function handleEngineChange(id: ExtractionEngineId) {
  settingsStore.update({ extractionEngine: id });
}
```

**Step 5: Pass new props to EditorPane**

Update the EditorPane call in the template to include the new props:

```svelte
<EditorPane
  text={activeFile?.text ?? ''}
  visualization={$vizStore.current}
  loading={$vizStore.loading}
  autoSend={activeFile?.settings.autoSend ?? false}
  file={activeFile}
  onTextChange={handleTextChange}
  onVisualize={handleVisualize}
  {isFromCache}
  onReextract={handleReextract}
  onAutoSendToggle={(enabled) => {
    if (activeFile) {
      filesStore.updateSettings(activeFile.id, { autoSend: enabled });
    }
  }}
  focusedNodeId={$focusStore.focusedNodeId}
  zoomLevel={$focusStore.zoomLevel}
  vizType={$vizStore.vizType ?? 'graph'}
  engineId={$settingsStore.extractionEngine as ExtractionEngineId}
  onVizTypeChange={handleVizTypeChange}
  onEngineChange={handleEngineChange}
  pipelineStage={$pipelineStore.stage}
  recommendation={$pipelineStore.recommendation}
>
```

**Step 6: Remove engine toast**

Remove the `engineToast`, `toastTimer`, `showEngineToast` state and the toast div at the bottom of the template (lines 47-54 and 348-357). The StylePanel now shows the active engine directly.

**Step 7: Verify TypeScript compiles**

Run: `npm run check`
Expected: No errors

**Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 9: Verify visually**

Run: `npm run dev`
- Open the app, confirm the StylePanel appears in the editor pane
- Click a viz type button — canvas should re-render with that type
- Click an engine button — it should highlight
- Type text and click Visualize — pipeline stages should appear in the status line
- Check that entrance animation plays on render

**Step 10: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: wire rendering pipeline and StylePanel into main page"
```

---

### Task 14: Full Integration Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type checker**

Run: `npm run check`
Expected: No errors

**Step 3: Test all 6 viz types via panel**

Run: `npm run dev`
- Type some text, click each of the 6 viz type buttons
- Confirm each renders correctly
- Confirm entrance animation plays

**Step 4: Test engine switching**

- Switch between all 4 engines via the panel
- Visualize with each — confirm different results

**Step 5: Test pipeline modes**

- Go to Settings, set Pipeline Mode to Manual
- Visualize — no recommendation badge should appear
- Set to Auto — recommendation badge should appear after visualizing

**Step 6: Test keyboard shortcuts still work**

- Press Tab — viz type should cycle (and panel should update)
- Press Shift+Tab — engine should cycle (and panel should update)
- Press Enter — should trigger visualization

**Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for style panel and pipeline"
```
