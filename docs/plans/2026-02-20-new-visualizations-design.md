# New Visualizations Design: Logical Flow Mapper & Storyboard

**Date**: 2026-02-20
**Status**: Approved

## Overview

Add two new visualization types to the concept visualizer:

1. **Logical Flow Mapper** (`logicalflow`) — argument/reasoning chains with premises, inferences, conclusions, evidence, and objections in a columnar DAG layout with role-based node shapes
2. **Storyboard** (`storyboard`) — branching narrative with named swim lanes that can fork/merge, rendered in horizontal or vertical orientation

Also adds **file-level visualization caching** so LLM extraction is skipped when content has not changed.

---

## Section 1 — Schema & Type Changes

### `VisualizationType` (extends from 4 → 6)
```ts
'graph' | 'tree' | 'flowchart' | 'hierarchy' | 'logicalflow' | 'storyboard'
```

### New `VisualizationNode` fields
```ts
logicalRole?: 'premise' | 'inference' | 'conclusion' | 'evidence' | 'objection'
storyRole?:   'scene' | 'event' | 'conflict' | 'resolution'
```

### Extended `VisualizationEdge.type` values
Added alongside existing values (`causes`, `contains`, `precedes`, `relates`, `contrasts`, `transforms`):
```
// Logical flow
'supports' | 'contradicts' | 'derives' | 'qualifies'

// Storyboard
'leads_to' | 'branches_to' | 'converges' | 'influences'
```

### New `VisualizationSchema` field
```ts
renderOptions?: {
  orientation?: 'horizontal' | 'vertical'  // storyboard only; default 'horizontal'
}
```

### `ConceptFile` caching fields
```ts
cachedSchemas?: Partial<Record<VisualizationType, {
  schema: VisualizationSchema;
  contentHash: string;
}>>
```

Per-type caching: switching from `graph` to `storyboard` on the same file triggers a fresh LLM call for storyboard, caches it separately.

---

## Section 2 — Logical Flow Mapper Renderer

**File**: `src/lib/components/visualizer/renderers/logicalflow.ts`

### Layout
Nodes sorted into three horizontal layers by `logicalRole`:

```
Layer 0 (top):    [premise]  [premise]  [evidence]  [evidence]
Layer 1 (middle): [inference]           [inference]
Layer 2 (bottom): [conclusion]          [objection]
```

- Nodes without `logicalRole` assigned by topological depth
- Layer vertical spacing: ~160px
- Horizontal spacing within layer: ~180px
- Edges flow top-down; contradictions are drawn red+dashed regardless of direction

### Node Shapes
| Role | Shape | Notes |
|---|---|---|
| `premise` | Rounded rect (rx=6) | Standard input |
| `evidence` | Small circle (r=10–14) | Annotation/support |
| `inference` | Hexagon (polygon) | Reasoning step |
| `conclusion` | Pill (rx=height/2) | Output/result |
| `objection` | Diamond (rotated square) | Counter-argument |

All interactive shapes use class `node-shape` for hover detection.

### Colors (mode-aware via `isDark` detection on `--canvas-bg`)

New helpers added to `utils.ts`:

```ts
logicalRoleColor(role, isDark): string
// premise   → blue   (light:#bfdbfe / dark:#3b82f6)
// evidence  → gray   (light:#e5e7eb / dark:#6b7280)
// inference → amber  (light:#fde68a / dark:#f59e0b)
// conclusion→ green  (light:#bbf7d0 / dark:#22c55e)
// objection → red    (light:#fecaca / dark:#ef4444)

edgeSemanticColor(type, isDark): string
// supports  → green  (light:#16a34a / dark:#4ade80)
// contradicts→ red   (light:#dc2626 / dark:#f87171)
// derives   → blue   (light:#2563eb / dark:#60a5fa)
// qualifies → amber  (light:#d97706 / dark:#fbbf24)
// default   → --viz-edge CSS var
```

Node border stroke: slightly darker shade of the same hue family.
Node text: `--text-primary` / `--text-secondary` (adaptive).

### Edge Rendering
- Arrow markers for all directed edges
- `contradicts` edges: dashed stroke pattern
- Edges to/from `objection` nodes: always drawn in red

### Interaction
- Hover → `NodeTooltip` (same as other renderers)
- Click → neighbourhood highlight (others fade to 12%)
- Detail glass cards via `appendDetailCard()` for nodes with `weight ≥ 0.65`

---

## Section 3 — Storyboard Renderer (Named Branching Lanes)

**File**: `src/lib/components/visualizer/renderers/storyboard.ts`

### Lane Detection
- Lane determined by `theme` field on each node
- Unique `theme` values become named lanes, ordered by first appearance
- Nodes without `theme` → `"Main"` lane

### Horizontal Mode (default)
```
         [Main]  ──[S1]────────────────[S5]──[S6]
                       ╲                   ╱
       [Hero arc] ────[S2]──[S3]──[S4]──╯
                                    ╲
     [Villain arc] ───────────────[S4b]──[S4c]
```
- Lane label column on left, colored lane background strip
- Scenes spread horizontally by topological order within lane
- Branch/merge connectors: diagonal bezier curves
- Lane colors: one color per lane from `THEME_COLORS_LIGHT`/`THEME_COLORS_DARK` palette

### Vertical Mode
- Same structure rotated 90°: lane labels along top, scenes spread downward
- Better for tall content and portrait viewports

### Node Shapes (mode-aware colors)
| Role | Shape | Tint |
|---|---|---|
| `scene` | Wide rect 120×50, title + details | Lane color (muted) |
| `event` | Diamond | Bright lane color |
| `conflict` | Hexagon | Red tint (light/dark aware) |
| `resolution` | Pill | Green tint (light/dark aware) |

All interactive shapes use class `node-shape`.

### Edge Semantics
| Type | Style |
|---|---|
| `leads_to` | Solid arrow, within lane |
| `branches_to` | Diagonal fork to new lane |
| `converges` | Diagonal merge back |
| `influences` | Dashed curve, cross-lane |

### Orientation Toggle
- `H/V` toggle button in editor pane, visible only when `schema.type === 'storyboard'`
- Updates `vizStore.storyboardOrientation: 'horizontal' | 'vertical'`
- `VisualizerCanvas` `$effect` re-renders on change — no LLM call

---

## Section 4 — File Caching

### Hash Utility
New file `src/lib/utils/hash.ts`:
```ts
export function hashContent(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(36);
}
```

### Cache Check Flow
```
User clicks Visualize
  → compute hashContent(file.content)
  → check file.cachedSchemas?.[vizType]
      hit (hash matches) → dispatch cached schema, skip LLM
      miss              → call extractor
                          → on success: write schema+hash to Dexie via filesStore.updateFile()
```

### Dexie Compatibility
`cachedSchemas` is a plain JSON object field on `ConceptFile`. No Dexie migration needed — IndexedDB stores arbitrary object fields. `filesStore.updateFile()` already exists.

### UI Feedback
- `"cached"` text badge next to Visualize button when showing a cached result
- Refresh icon button (`Re-extract`) clears `cachedSchemas[vizType]` for current file and triggers fresh LLM call
- No badge shown during initial extraction or after re-extract

---

## Section 5 — VisualizerCanvas & Hover Detection

### Standardised `node-shape` Class
All interactive node shapes across all renderers get class `node-shape`. Canvas selector changes from:
```ts
// before
svg.querySelectorAll('circle:not(.glow), g.node rect')
// after
svg.querySelectorAll('.node-shape:not(.glow)')
```

### Existing Renderer Updates (mechanical, low-risk)
Add `node-shape` class to primary hit-testable element:
- `graph.ts` → circles
- `tree.ts` → circles
- `flowchart.ts` → rects
- `hierarchy.ts` → circles

`__data__` extraction logic in the canvas is unchanged — D3 still binds datum to the element.

---

## Section 6 — LLM Prompt Additions

Two new prompt cases added to the existing extractor registry dispatch (no interface changes).

### Logical Flow Prompt
Instructs LLM to:
- Identify premises, inferences, conclusions, evidence, objections
- Set `logicalRole` on every node
- Use `weight` for certainty/support strength (0–1)
- Use `theme` to group nodes into named argument strands
- Use edge `type` from: `supports`, `contradicts`, `derives`, `qualifies`
- Use edge `strength` for logical connection strength

### Storyboard Prompt
Instructs LLM to:
- Identify scenes, pivotal events, conflicts, resolutions
- Set `storyRole` on every node
- Set `theme` to the story thread / character arc name (becomes lane label)
- Use `weight` for narrative importance
- Use edge `type` from: `leads_to`, `branches_to`, `converges`, `influences`
- Set `narrativeRole` as usual (`central` for protagonist arc, `outcome` for resolutions)

---

## Files Changed / Created

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `logicalRole`, `storyRole`, new edge types, `renderOptions`, `cachedSchemas` |
| `src/lib/utils/hash.ts` | NEW: `hashContent()` |
| `src/lib/components/visualizer/renderers/utils.ts` | Add `logicalRoleColor()`, `edgeSemanticColor()` |
| `src/lib/components/visualizer/renderers/logicalflow.ts` | NEW: logical flow renderer |
| `src/lib/components/visualizer/renderers/storyboard.ts` | NEW: storyboard renderer |
| `src/lib/components/visualizer/renderers/index.ts` | Register new renderers |
| `src/lib/components/visualizer/renderers/graph.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/renderers/tree.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/renderers/flowchart.ts` | Add `node-shape` class to rects |
| `src/lib/components/visualizer/renderers/hierarchy.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/VisualizerCanvas.svelte` | Update hover selector, handle `storyboardOrientation` |
| `src/lib/stores/vizStore.ts` | Add `storyboardOrientation` state |
| `src/lib/stores/filesStore.ts` | Expose cache read/write via `updateFile()` |
| `src/lib/llm/prompts.ts` | Add `logicalflow` and `storyboard` prompt cases |
| `src/lib/components/editor/EditorPane.svelte` | Add cached badge, re-extract button, H/V toggle |
| Visualization trigger (page/store) | Insert cache check before extractor call |
