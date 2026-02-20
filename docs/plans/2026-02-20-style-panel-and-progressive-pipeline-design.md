# Style Switching Panel & Progressive Rendering Pipeline — Design

**Date:** 2026-02-20

## Problem

The app supports 6 visualization types and 4 extraction engines, but switching relies on keyboard shortcuts (Tab / Shift+Tab) with only a fleeting toast for feedback. There is no persistent UI for seeing what's selected or jumping directly to a specific style. Rendering is also instantaneous — the visualization appears all at once with no sense of structure emerging.

## Goals

1. Add a visible, always-accessible panel for switching visualization styles and extraction engines.
2. Build a rendering pipeline that progressively analyzes, extracts, and renders visualizations with staged animation.

---

## Feature 1: Style/Engine Switching Panel

### Component: `StylePanel.svelte`

A new collapsible `Panel` inside `EditorPane`, placed between the Context panel and the Input panel. Contains:

**Viz Type Row** — segmented control with 6 buttons:
- `graph` | `tree` | `flowchart` | `hierarchy` | `logicalflow` | `storyboard`
- Each button: small SVG icon + short label
- Active type highlighted with `var(--accent)` background
- Click triggers `vizStore.setVizType(type)` and re-render
- If pipeline has a recommendation, the recommended type shows a star indicator

**Engine Row** — segmented control with 4 buttons:
- `LLM` | `NLP` | `Keywords` | `Semantic`
- Active one highlighted, click calls `settingsStore.update({ extractionEngine: id })`

**Storyboard Orientation** — existing H/V toggle relocates here, visible only when storyboard is selected.

**Pipeline Status Line** — single line below buttons:
- Active: `Analyzing… → Extracting… → Rendering…` (current stage)
- Idle: `★ Recommended: flowchart` (last recommendation from analyzer)

### EditorPane Changes

- Add `StylePanel` between Context and Input panels
- Remove storyboard orientation toggle from Input panel (moved into StylePanel)

### +page.svelte Changes

- `cycleVizType()` and `cycleEngine()` remain for keyboard shortcuts
- Remove engine toast notification (panel makes it redundant)

### Props Flow

```
+page.svelte
  └─ EditorPane
       └─ StylePanel
            ├─ vizType (from vizStore)
            ├─ engineId (from settingsStore)
            ├─ onVizTypeChange(type)
            ├─ onEngineChange(id)
            ├─ pipelineStage (from pipelineStore)
            └─ recommendation (from pipelineStore)
```

---

## Feature 2: Progressive Rendering Pipeline

### Architecture

New module at `src/lib/pipeline/` with four files:

```
src/lib/pipeline/
  types.ts         — Pipeline types
  analyzer.ts      — TextAnalyzer (heuristic scoring)
  store.ts         — pipelineStore (Svelte writable store)
  orchestrator.ts  — RenderingPipeline class
```

### Types (`types.ts`)

```ts
type PipelineStage = 'idle' | 'analyzing' | 'refining' | 'extracting' | 'rendering' | 'complete' | 'error';

interface PipelineState {
  stage: PipelineStage;
  recommendation: { type: VisualizationType; confidence: number } | null;
  scores: Record<VisualizationType, number> | null;
  error: string | null;
}
```

### Text Analyzer (`analyzer.ts`)

Scores text against all 6 viz types using lightweight string/regex heuristics:

| Viz Type      | Signals                                                        |
|---------------|----------------------------------------------------------------|
| `graph`       | Many cross-references, diverse entities, no clear ordering     |
| `tree`        | "is-a", "type of", "kind of", taxonomic language              |
| `flowchart`   | "then", "next", "after", "step", numbered lists               |
| `hierarchy`   | "contains", "includes", "consists of", part-whole             |
| `logicalflow` | "because", "therefore", "however", argument markers           |
| `storyboard`  | Character names, dialogue, scene transitions, narrative arcs  |

Returns `Record<VisualizationType, number>` (scores 0–1). Runs in <5ms. No external dependencies.

### Pipeline Store (`store.ts`)

Svelte writable store exposing:
- `stage` — current pipeline stage
- `recommendation` — top-scored viz type + confidence
- `scores` — all viz type scores
- `error` — error message if any
- Methods: `setStage()`, `setRecommendation()`, `setError()`, `reset()`

### Orchestrator (`orchestrator.ts`)

```ts
class RenderingPipeline {
  constructor(
    registry: ExtractorRegistry,
    analyzer: TextAnalyzer,
    pipelineStore: PipelineStore,
    settings: () => AppSettings
  )

  async run(text: string, vizType: VisualizationType, engineId: ExtractionEngineId): Promise<VisualizationSchema>
  abort(): void
}
```

**Stages in `auto` mode:**

1. **Analyze** (`analyzing`): `analyzer.analyzeText(text)` → scored recommendations. Instant.
2. **Refine** (`refining`): If `llmRefinement` enabled, send brief classification prompt to LLM. 2s timeout, graceful fallback. Skippable.
3. **Extract** (`extracting`): `registry.getEngine(engineId).extract(text, vizType)`. For LLM this is the longest stage; for local engines, instant.
4. **Render** (`rendering`): Return schema. Canvas handles actual D3 rendering with entrance animation.

**In `manual` mode:** Skip analyze/refine, go straight to extract → render.

**Cancellation:** Each `run()` creates an `AbortController`. Calling `abort()` or starting a new run cancels the previous one.

### Progressive Render Animation

New `animateEntrance(svg)` utility in `renderers/utils.ts`:

- Phase 1 (0–200ms): Nodes fade in, scale 0.8→1.0
- Phase 2 (200–500ms): Edges draw in (stroke-dashoffset)
- Phase 3 (500–700ms): Labels fade in
- Phase 4 (700–900ms): Detail cards slide in

Uses CSS transitions on SVG elements. Runs once per render, not on zoom/pan.

### Integration into `+page.svelte`

```ts
// Current:
const viz = await engine.extract(activeFile.text, vizType);

// New:
const viz = await pipeline.run(activeFile.text, vizType, engineId);
```

Cache checking still happens before pipeline runs (unchanged).

---

## Settings Page Changes

### New AppSettings Fields

```ts
pipelineMode: 'auto' | 'manual'   // default: 'auto'
llmRefinement: boolean              // default: false
```

### New UI Section in Settings

A "Pipeline" section between Theme and Control Placement:
1. **Pipeline Mode** dropdown: `Auto` / `Manual`
2. **LLM Refinement** checkbox (visible only when mode is `auto`)

---

## File Changes Summary

| Category | Files |
|----------|-------|
| **New** | `src/lib/pipeline/types.ts`, `analyzer.ts`, `store.ts`, `orchestrator.ts`; `src/lib/components/editor/StylePanel.svelte` |
| **Modified** | `EditorPane.svelte`, `+page.svelte`, `settings/+page.svelte`, `src/lib/stores/visualization.ts`, `src/lib/components/visualizer/renderers/utils.ts`, `src/lib/types.ts` |

---

## Testing

| Module | Key Tests |
|--------|-----------|
| `analyzer.ts` | Sequential text → flowchart ranked highest; hierarchical → tree; argument → logicalflow; narrative → storyboard |
| `orchestrator.ts` | Full auto pipeline; manual skips analyze/refine; cancellation; error propagation |
| `store.ts` | Stage transitions; reset |

Existing `handleVisualize` flow works identically from user perspective — pipeline wraps transparently.
