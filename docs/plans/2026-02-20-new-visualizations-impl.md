# New Visualizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `logicalflow` and `storyboard` visualization types, with per-file/per-type LLM result caching.

**Architecture:** Six schema types (up from four); two new D3 renderers sharing existing utils; a djb2 hash-based cache stored per-type in `ConceptFile.cachedSchemas`; type-specific LLM prompts; an orientation toggle for storyboard; standardised `node-shape` CSS class across all renderers.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, D3 v7, Dexie/IndexedDB, Vitest + jsdom.

**Reference:** `docs/plans/2026-02-20-new-visualizations-design.md`

---

## Task 1: Create dev branch

**Files:** none

**Step 1: Create and switch to dev branch**

```bash
git checkout -b feat/new-visualizations
```

**Step 2: Verify**

```bash
git branch --show-current
# expected: feat/new-visualizations
```

---

## Task 2: Extend `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts`

The current file has 64 lines. We are extending types, not rewriting them.

**Step 1: Write failing type test**

Create `src/lib/types.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { VisualizationType, VisualizationNode, VisualizationEdge, VisualizationSchema, ConceptFile } from './types';

describe('extended types', () => {
  it('VisualizationType includes logicalflow and storyboard', () => {
    const t1: VisualizationType = 'logicalflow';
    const t2: VisualizationType = 'storyboard';
    expectTypeOf(t1).toEqualTypeOf<VisualizationType>();
    expectTypeOf(t2).toEqualTypeOf<VisualizationType>();
  });

  it('VisualizationNode accepts logicalRole and storyRole', () => {
    const n: VisualizationNode = {
      id: 'a', label: 'A',
      logicalRole: 'premise',
      storyRole: 'scene'
    };
    expectTypeOf(n.logicalRole).toEqualTypeOf<'premise' | 'inference' | 'conclusion' | 'evidence' | 'objection' | undefined>();
    expectTypeOf(n.storyRole).toEqualTypeOf<'scene' | 'event' | 'conflict' | 'resolution' | undefined>();
  });

  it('VisualizationSchema accepts renderOptions', () => {
    const s: Pick<VisualizationSchema, 'renderOptions'> = {
      renderOptions: { orientation: 'vertical' }
    };
    expectTypeOf(s.renderOptions?.orientation).toEqualTypeOf<'horizontal' | 'vertical' | undefined>();
  });

  it('ConceptFile accepts cachedSchemas', () => {
    const f: Pick<ConceptFile, 'cachedSchemas'> = {
      cachedSchemas: {
        logicalflow: { schema: {} as any, contentHash: 'abc' }
      }
    };
    expectTypeOf(f.cachedSchemas).not.toBeUndefined();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx vitest run src/lib/types.test.ts
# expected: TypeScript compile error — logicalflow/storyboard not in VisualizationType
```

**Step 3: Update `src/lib/types.ts`**

Replace the entire file:

```ts
export type VisualizationType =
  | 'graph' | 'tree' | 'flowchart' | 'hierarchy'
  | 'logicalflow' | 'storyboard';

export type NarrativeRole = 'central' | 'supporting' | 'contextual' | 'outcome';

export type LogicalRole = 'premise' | 'inference' | 'conclusion' | 'evidence' | 'objection';

export type StoryRole = 'scene' | 'event' | 'conflict' | 'resolution';

export interface VisualizationNode {
  id: string;
  label: string;
  details?: string;
  weight?: number;
  theme?: string;
  narrativeRole?: NarrativeRole;
  logicalRole?: LogicalRole;
  storyRole?: StoryRole;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
  strength?: number;
}

export interface VisualizationSchema {
  type: VisualizationType;
  title: string;
  description: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata: {
    concepts: string[];
    relationships: string[];
  };
  renderOptions?: {
    orientation?: 'horizontal' | 'vertical';
  };
}

export interface ConceptFile {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  text: string;
  visualization: VisualizationSchema | null;
  settings: {
    autoSend: boolean;
    vizType?: VisualizationType;
  };
  cachedSchemas?: Partial<Record<VisualizationType, {
    schema: VisualizationSchema;
    contentHash: string;
  }>>;
}

export interface AppSettings {
  id: string;
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
  controlPlacement: 'hud' | 'dock' | 'embedded';
  extractionEngine: 'llm' | 'nlp' | 'keywords' | 'semantic';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light',
  controlPlacement: 'hud',
  extractionEngine: 'llm'
};
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/types.test.ts
# expected: PASS
```

**Step 5: Check no existing tests broke**

```bash
npx vitest run
# expected: all pass
```

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: extend types for logicalflow, storyboard, and file caching"
```

---

## Task 3: Add content hash utility

**Files:**
- Create: `src/lib/utils/hash.ts`
- Create: `src/lib/utils/hash.test.ts`

**Step 1: Write failing test**

```ts
// src/lib/utils/hash.test.ts
import { describe, it, expect } from 'vitest';
import { hashContent } from './hash';

describe('hashContent', () => {
  it('returns a string', () => {
    expect(typeof hashContent('hello')).toBe('string');
  });

  it('is deterministic', () => {
    expect(hashContent('hello world')).toBe(hashContent('hello world'));
  });

  it('differs for different inputs', () => {
    expect(hashContent('foo')).not.toBe(hashContent('bar'));
  });

  it('handles empty string', () => {
    expect(hashContent('')).toBe(hashContent(''));
  });

  it('handles long text without throwing', () => {
    const long = 'x'.repeat(100_000);
    expect(() => hashContent(long)).not.toThrow();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx vitest run src/lib/utils/hash.test.ts
# expected: FAIL — cannot find module './hash'
```

**Step 3: Create `src/lib/utils/hash.ts`**

```ts
/** djb2 hash — fast, deterministic, no crypto needed for cache keys. */
export function hashContent(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
```

**Step 4: Run test**

```bash
npx vitest run src/lib/utils/hash.test.ts
# expected: PASS (5 tests)
```

**Step 5: Commit**

```bash
git add src/lib/utils/hash.ts src/lib/utils/hash.test.ts
git commit -m "feat: add djb2 hash utility for cache invalidation"
```

---

## Task 4: Add semantic color helpers to renderer utils

**Files:**
- Modify: `src/lib/components/visualizer/renderers/utils.ts`
- Create: `src/lib/components/visualizer/renderers/utils.test.ts`

**Step 1: Write failing tests**

```ts
// src/lib/components/visualizer/renderers/utils.test.ts
import { describe, it, expect } from 'vitest';
import { logicalRoleColor, edgeSemanticColor } from './utils';
import type { LogicalRole } from '$lib/types';

describe('logicalRoleColor', () => {
  const roles: LogicalRole[] = ['premise', 'evidence', 'inference', 'conclusion', 'objection'];

  roles.forEach(role => {
    it(`returns a hex string for role "${role}" in light mode`, () => {
      expect(logicalRoleColor(role, false)).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it(`returns a hex string for role "${role}" in dark mode`, () => {
      expect(logicalRoleColor(role, true)).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it(`light and dark are different for "${role}"`, () => {
      expect(logicalRoleColor(role, false)).not.toBe(logicalRoleColor(role, true));
    });
  });

  it('falls back for undefined role', () => {
    expect(logicalRoleColor(undefined, false)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('edgeSemanticColor', () => {
  ['supports', 'contradicts', 'derives', 'qualifies'].forEach(type => {
    it(`returns a color for "${type}"`, () => {
      expect(edgeSemanticColor(type, false)).toBeTruthy();
      expect(edgeSemanticColor(type, true)).toBeTruthy();
    });
  });

  it('falls back to CSS var for unknown type', () => {
    expect(edgeSemanticColor('unknown', false)).toBe('var(--viz-edge)');
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx vitest run src/lib/components/visualizer/renderers/utils.test.ts
# expected: FAIL — logicalRoleColor/edgeSemanticColor not exported
```

**Step 3: Append to `src/lib/components/visualizer/renderers/utils.ts`**

Add after the last export (after `appendDetailCard`):

```ts
// ── Logical flow semantic colors ──────────────────────────────────────────

const LOGICAL_ROLE_COLORS: Record<string, { light: string; dark: string }> = {
  premise:    { light: '#bfdbfe', dark: '#3b82f6' },
  evidence:   { light: '#e5e7eb', dark: '#6b7280' },
  inference:  { light: '#fde68a', dark: '#f59e0b' },
  conclusion: { light: '#bbf7d0', dark: '#22c55e' },
  objection:  { light: '#fecaca', dark: '#ef4444' },
};

/** Node fill tint for a logical role, mode-aware. */
export function logicalRoleColor(
  role: string | undefined,
  isDark: boolean
): string {
  const entry = role ? LOGICAL_ROLE_COLORS[role] : undefined;
  if (!entry) return isDark ? '#374151' : '#f3f4f6';
  return isDark ? entry.dark : entry.light;
}

const EDGE_SEMANTIC_COLORS: Record<string, { light: string; dark: string }> = {
  supports:    { light: '#16a34a', dark: '#4ade80' },
  contradicts: { light: '#dc2626', dark: '#f87171' },
  derives:     { light: '#2563eb', dark: '#60a5fa' },
  qualifies:   { light: '#d97706', dark: '#fbbf24' },
};

/** Edge stroke color for a semantic edge type, mode-aware. Falls back to CSS var. */
export function edgeSemanticColor(
  type: string | undefined,
  isDark: boolean
): string {
  const entry = type ? EDGE_SEMANTIC_COLORS[type] : undefined;
  if (!entry) return 'var(--viz-edge)';
  return isDark ? entry.dark : entry.light;
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/components/visualizer/renderers/utils.test.ts
# expected: PASS
```

**Step 5: Commit**

```bash
git add src/lib/components/visualizer/renderers/utils.ts src/lib/components/visualizer/renderers/utils.test.ts
git commit -m "feat: add logicalRoleColor and edgeSemanticColor helpers to renderer utils"
```

---

## Task 5: Standardise `node-shape` class on existing renderers + update canvas selector

**Files:**
- Modify: `src/lib/components/visualizer/renderers/graph.ts`
- Modify: `src/lib/components/visualizer/renderers/tree.ts`
- Modify: `src/lib/components/visualizer/renderers/flowchart.ts`
- Modify: `src/lib/components/visualizer/renderers/hierarchy.ts`
- Modify: `src/lib/components/visualizer/VisualizerCanvas.svelte:44`

For each renderer, find the `.join(...)` call that creates the primary interactive shape and append `.attr('class', ...)` including `node-shape`. Use Grep to find the exact lines before editing.

**Step 1: Find interactive shape creation in each renderer**

```bash
grep -n "\.join\|\.append.*circle\|\.append.*rect" src/lib/components/visualizer/renderers/graph.ts src/lib/components/visualizer/renderers/tree.ts src/lib/components/visualizer/renderers/flowchart.ts src/lib/components/visualizer/renderers/hierarchy.ts
```

**Step 2: In `graph.ts` — add `node-shape` to node circles**

Find the line that appends circles to node groups (not glow rings). It looks like:
```ts
.join('circle')
```
Change it to:
```ts
.join('circle')
.attr('class', 'node-shape')
```

If the circle already has a class set via `.attr('class', ...)`, append `node-shape` to the existing class value.

**Step 3: In `tree.ts` — add `node-shape` to node circles**

Same pattern: find `.join('circle')` or `.append('circle')` on node elements (not glow rings), add `.attr('class', 'node-shape')`.

**Step 4: In `flowchart.ts` — add `node-shape` to pill rects**

The rect is appended at line ~112:
```ts
nodeG.append('rect')
```
Add `.attr('class', 'node-shape')` as the first attribute call on this rect:
```ts
nodeG.append('rect')
  .attr('class', 'node-shape')
  .attr('width', NODE_WIDTH)
  ...
```

**Step 5: In `hierarchy.ts` — add `node-shape` to node circles**

Same pattern as graph/tree.

**Step 6: Update VisualizerCanvas.svelte selector**

At line 44, change:
```ts
const nodeElements = svgEl.querySelectorAll('circle:not(.glow), g.node rect');
```
to:
```ts
const nodeElements = svgEl.querySelectorAll('.node-shape:not(.glow)');
```

**Step 7: Run all tests and dev server smoke test**

```bash
npx vitest run
# expected: all pass
npm run check
# expected: no type errors
```

**Step 8: Commit**

```bash
git add src/lib/components/visualizer/renderers/graph.ts src/lib/components/visualizer/renderers/tree.ts src/lib/components/visualizer/renderers/flowchart.ts src/lib/components/visualizer/renderers/hierarchy.ts src/lib/components/visualizer/VisualizerCanvas.svelte
git commit -m "refactor: standardise node-shape class across all renderers for unified hover detection"
```

---

## Task 6: Add `logicalflow` renderer

**Files:**
- Create: `src/lib/components/visualizer/renderers/logicalflow.ts`
- Modify: `src/lib/components/visualizer/renderers/index.ts`

**Step 1: Read `flowchart.ts` in full** — it is the closest structural reference (layer-based positioning, arrow markers, detail cards). You have already read it above.

**Step 2: Create `src/lib/components/visualizer/renderers/logicalflow.ts`**

```ts
import * as d3 from 'd3';
import type { VisualizationSchema, LogicalRole } from '$lib/types';
import {
  logicalRoleColor, edgeSemanticColor, edgeThickness, edgeOpacity,
  hexToRgba, truncate, parseSvgDimensions, setupD3Zoom,
  CARD_W, CARD_H, appendDetailCard
} from './utils';

// Layer order: premises/evidence at top, inferences middle, conclusions/objections bottom
const LAYER_ORDER: (LogicalRole | '_default')[] = ['premise', 'evidence', 'inference', 'conclusion', 'objection', '_default'];
const LAYER_MAP: Record<LogicalRole, number> = {
  premise: 0, evidence: 0,
  inference: 1,
  conclusion: 2, objection: 2
};

const NODE_W = 144;
const NODE_H = 40;
const LAYER_GAP_Y = 160;
const COL_GAP_X = 180;

/** Detect dark mode from --canvas-bg CSS custom property */
function detectDark(svgEl: SVGSVGElement): boolean {
  const bg = getComputedStyle(svgEl).getPropertyValue('--canvas-bg').trim();
  return bg.startsWith('#0') || bg.startsWith('rgb(0') || bg.startsWith('rgb(1') || bg.startsWith('rgb(2');
}

/** Draw a hexagon polygon path centred at (cx, cy) with given radius */
function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

/** Draw a diamond polygon path centred at (cx, cy) */
function diamondPath(cx: number, cy: number, w: number, h: number): string {
  return `M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy}Z`;
}

export function renderLogicalFlow(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width } = parseSvgDimensions(svgEl);
  const isDark = detectDark(svgEl);

  // Assign layer by logicalRole, then topological depth for unassigned nodes
  const topoDepth = new Map<string, number>();
  const inDeg = new Map<string, number>(schema.nodes.map(n => [n.id, 0]));
  schema.edges.forEach(e => inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1));
  const queue = schema.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  let depth = 0;
  const seen = new Set<string>();
  while (queue.length > 0) {
    const lvl = queue.splice(0, queue.length);
    lvl.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      topoDepth.set(id, depth);
      schema.edges.filter(e => e.source === id).forEach(e => {
        const d = (inDeg.get(e.target) ?? 1) - 1;
        inDeg.set(e.target, d);
        if (d === 0) queue.push(e.target);
      });
    });
    depth++;
  }
  schema.nodes.filter(n => !seen.has(n.id)).forEach(n => topoDepth.set(n.id, depth));

  // Group nodes into layers
  const layers: string[][] = [[], [], []];
  schema.nodes.forEach(n => {
    const role = n.logicalRole;
    if (role && LAYER_MAP[role] !== undefined) {
      layers[LAYER_MAP[role]].push(n.id);
    } else {
      const d = Math.min(topoDepth.get(n.id) ?? 0, 2);
      layers[d].push(n.id);
    }
  });

  // Compute positions
  const positions = new Map<string, { x: number; y: number }>();
  const topY = 80;
  layers.forEach((ids, layerIdx) => {
    const totalW = ids.length * (NODE_W + COL_GAP_X) - COL_GAP_X;
    const startX = width / 2 - totalW / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: startX + i * (NODE_W + COL_GAP_X) + NODE_W / 2,
        y: topY + layerIdx * LAYER_GAP_Y
      });
    });
  });

  // Arrow markers
  const defs = svg.append('defs');
  const markerColors: Array<{ id: string; color: string }> = [
    { id: 'lf-arrow-default', color: 'var(--viz-edge)' },
    { id: 'lf-arrow-supports', color: edgeSemanticColor('supports', isDark) },
    { id: 'lf-arrow-contradicts', color: edgeSemanticColor('contradicts', isDark) },
    { id: 'lf-arrow-derives', color: edgeSemanticColor('derives', isDark) },
    { id: 'lf-arrow-qualifies', color: edgeSemanticColor('qualifies', isDark) },
  ];
  markerColors.forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .style('fill', color);
  });

  const g = svg.append('g');
  setupD3Zoom(svg, g);

  // Edges
  g.selectAll('path.lf-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'lf-edge')
    .attr('d', d => {
      const s = positions.get(d.source) ?? { x: 0, y: 0 };
      const t = positions.get(d.target) ?? { x: 0, y: 0 };
      const my = (s.y + NODE_H / 2 + t.y - NODE_H / 2) / 2;
      return `M${s.x},${s.y + NODE_H / 2} C${s.x},${my} ${t.x},${my} ${t.x},${t.y - NODE_H / 2}`;
    })
    .style('fill', 'none')
    .style('stroke', d => {
      const tNode = schema.nodes.find(n => n.id === d.target);
      const sNode = schema.nodes.find(n => n.id === d.source);
      if (tNode?.logicalRole === 'objection' || sNode?.logicalRole === 'objection') {
        return edgeSemanticColor('contradicts', isDark);
      }
      return edgeSemanticColor(d.type, isDark);
    })
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'contradicts' ? '6,4' : null)
    .attr('marker-end', d => {
      const tNode = schema.nodes.find(n => n.id === d.target);
      const sNode = schema.nodes.find(n => n.id === d.source);
      if (tNode?.logicalRole === 'objection' || sNode?.logicalRole === 'objection') return 'url(#lf-arrow-contradicts)';
      const key = d.type && EDGE_SEMANTIC_COLORS_KEYS.includes(d.type) ? d.type : 'default';
      return `url(#lf-arrow-${key})`;
    });

  // Edge labels for strong edges
  g.selectAll('text.lf-edge-label')
    .data(schema.edges.filter(e => (e.strength ?? 0.5) > 0.6))
    .join('text')
    .attr('class', 'lf-edge-label')
    .text(d => d.label || d.type || '')
    .attr('x', d => ((positions.get(d.source)?.x ?? 0) + (positions.get(d.target)?.x ?? 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y ?? 0) + (positions.get(d.target)?.y ?? 0)) / 2 - 6)
    .attr('font-size', '9px')
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--viz-edge-label)')
    .style('pointer-events', 'none');

  // Node groups
  const nodeG = g.selectAll('g.lf-node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'lf-node')
    .attr('transform', d => {
      const pos = positions.get(d.id) ?? { x: 0, y: 0 };
      return `translate(${pos.x},${pos.y})`;
    });

  // Draw shape per logicalRole
  nodeG.each(function(d) {
    const group = d3.select(this);
    const role = d.logicalRole;
    const fill = hexToRgba(logicalRoleColor(role, isDark), 0.85);
    const stroke = logicalRoleColor(role, isDark);
    const r = NODE_H / 2;

    if (role === 'inference') {
      // Hexagon
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', hexPath(0, 0, r + 4))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'objection') {
      // Diamond
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', diamondPath(0, 0, NODE_W * 0.75, NODE_H + 10))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'conclusion') {
      // Pill
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
        .attr('width', NODE_W).attr('height', NODE_H)
        .attr('rx', NODE_H / 2).attr('ry', NODE_H / 2)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'evidence') {
      // Small circle
      group.append('circle')
        .attr('class', 'node-shape')
        .attr('r', r - 4)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else {
      // Rounded rect (premise and default)
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
        .attr('width', NODE_W).attr('height', NODE_H)
        .attr('rx', 6).attr('ry', 6)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    }

    // Label
    group.append('text')
      .text(truncate(d.label, 18))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', d.narrativeRole === 'central' ? '600' : '400')
      .style('fill', 'var(--text-primary)')
      .style('pointer-events', 'none');

    // Detail card for important nodes
    if (d.details && (d.weight ?? 0) >= 0.65) {
      const cardX = -CARD_W / 2;
      const cardY = NODE_H / 2 + 8;
      appendDetailCard(
        group,
        0, NODE_H / 2,
        0, cardY,
        cardX, cardY,
        truncate(d.details, 30)
      );
    }
  });
}

// Internal key set for marker lookup
const EDGE_SEMANTIC_COLORS_KEYS = ['supports', 'contradicts', 'derives', 'qualifies'];
```

**Step 3: Register in `src/lib/components/visualizer/renderers/index.ts`**

```ts
import type { VisualizationSchema, VisualizationType } from '$lib/types';
import { renderGraph } from './graph';
import { renderTree } from './tree';
import { renderFlowchart } from './flowchart';
import { renderHierarchy } from './hierarchy';
import { renderLogicalFlow } from './logicalflow';
import { renderStoryboard } from './storyboard';  // will add in Task 7

type Renderer = (svg: SVGSVGElement, schema: VisualizationSchema) => void;

const renderers: Record<VisualizationType, Renderer> = {
  graph: renderGraph,
  tree: renderTree,
  flowchart: renderFlowchart,
  hierarchy: renderHierarchy,
  logicalflow: renderLogicalFlow,
  storyboard: renderStoryboard   // will add in Task 7
};

export function renderVisualization(svg: SVGSVGElement, schema: VisualizationSchema): void {
  const renderer = renderers[schema.type];
  if (!renderer) {
    throw new Error(`Unknown visualization type: ${schema.type}`);
  }
  renderer(svg, schema);
}
```

> Note: Add the `storyboard` import/entry as a placeholder pointing to `./storyboard` — create a stub file first so TypeScript doesn't error.

**Step 4: Type check**

```bash
npm run check
# expected: no errors (assuming storyboard stub exists)
```

**Step 5: Commit**

```bash
git add src/lib/components/visualizer/renderers/logicalflow.ts src/lib/components/visualizer/renderers/index.ts
git commit -m "feat: add logicalflow renderer — columnar DAG with role-based shapes and semantic edge colors"
```

---

## Task 7: Add `storyboard` renderer

**Files:**
- Create: `src/lib/components/visualizer/renderers/storyboard.ts`

The storyboard renderer draws named horizontal or vertical swim lanes. Lane is determined by `node.theme`. Orientation is read from `schema.renderOptions?.orientation` (default `'horizontal'`).

**Step 1: Create `src/lib/components/visualizer/renderers/storyboard.ts`**

```ts
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import {
  themeColorForMode, edgeThickness, edgeOpacity, hexToRgba, truncate,
  parseSvgDimensions, setupD3Zoom, appendDetailCard, CARD_W, CARD_H
} from './utils';

const SCENE_W = 130;
const SCENE_H = 52;
const LANE_PADDING = 20;
const NODE_GAP = 80;         // gap between scenes along the flow axis
const LANE_BREADTH = 110;    // lane width (vertical) or height (horizontal)
const LABEL_SIZE = 20;       // space for lane label
const CONFLICT_COLORS = { light: '#fecaca', dark: '#ef4444' };
const RESOLUTION_COLORS = { light: '#bbf7d0', dark: '#22c55e' };

function detectDark(svgEl: SVGSVGElement): boolean {
  const bg = getComputedStyle(svgEl).getPropertyValue('--canvas-bg').trim();
  return bg.startsWith('#0') || bg.startsWith('rgb(0') || bg.startsWith('rgb(1') || bg.startsWith('rgb(2');
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

function diamondPath(cx: number, cy: number, w: number, h: number): string {
  return `M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy}Z`;
}

export function renderStoryboard(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width, height } = parseSvgDimensions(svgEl);
  const isDark = detectDark(svgEl);
  const isVertical = schema.renderOptions?.orientation === 'vertical';

  // ── Lane detection ──────────────────────────────────────────────────────
  const laneNames: string[] = [];
  schema.nodes.forEach(n => {
    const lane = n.theme ?? 'Main';
    if (!laneNames.includes(lane)) laneNames.push(lane);
  });
  const laneIndex = new Map(laneNames.map((name, i) => [name, i]));

  // ── Topological order per lane ──────────────────────────────────────────
  const inDeg = new Map<string, number>(schema.nodes.map(n => [n.id, 0]));
  schema.edges.forEach(e => inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1));
  const topoOrder: string[] = [];
  const queue = schema.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    topoOrder.push(id);
    schema.edges.filter(e => e.source === id).forEach(e => {
      const d = (inDeg.get(e.target) ?? 1) - 1;
      inDeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    });
  }
  schema.nodes.filter(n => !seen.has(n.id)).forEach(n => topoOrder.push(n.id));

  // Assign column index per lane (position along flow axis)
  const laneColCursor = new Map<number, number>(laneNames.map((_, i) => [i, 0]));
  const nodeCol = new Map<string, number>();
  topoOrder.forEach(id => {
    const node = schema.nodes.find(n => n.id === id)!;
    const lane = laneIndex.get(node.theme ?? 'Main') ?? 0;
    nodeCol.set(id, laneColCursor.get(lane) ?? 0);
    laneColCursor.set(lane, (laneColCursor.get(lane) ?? 0) + 1);
  });

  // ── Positions ──────────────────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number }>();

  if (!isVertical) {
    // Horizontal: lanes run left-to-right
    // Lane band: y = LABEL_SIZE + laneIdx * LANE_BREADTH + LANE_PADDING
    const originX = LABEL_SIZE + 60;
    schema.nodes.forEach(n => {
      const lane = laneIndex.get(n.theme ?? 'Main') ?? 0;
      const col = nodeCol.get(n.id) ?? 0;
      positions.set(n.id, {
        x: originX + col * (SCENE_W + NODE_GAP) + SCENE_W / 2,
        y: LABEL_SIZE + LANE_PADDING + lane * LANE_BREADTH + LANE_BREADTH / 2
      });
    });
  } else {
    // Vertical: lanes run top-to-bottom
    const originY = LABEL_SIZE + 60;
    schema.nodes.forEach(n => {
      const lane = laneIndex.get(n.theme ?? 'Main') ?? 0;
      const col = nodeCol.get(n.id) ?? 0;
      positions.set(n.id, {
        x: LABEL_SIZE + LANE_PADDING + lane * LANE_BREADTH + LANE_BREADTH / 2,
        y: originY + col * (SCENE_H + NODE_GAP) + SCENE_H / 2
      });
    });
  }

  const g = svg.append('g');
  setupD3Zoom(svg, g);

  // ── Lane background strips ─────────────────────────────────────────────
  laneNames.forEach((name, i) => {
    const laneColor = themeColorForMode(name, isDark);
    if (!isVertical) {
      const y = LABEL_SIZE + i * LANE_BREADTH;
      // background strip
      g.append('rect')
        .attr('x', 0).attr('y', y)
        .attr('width', width).attr('height', LANE_BREADTH)
        .style('fill', hexToRgba(laneColor, isDark ? 0.06 : 0.04))
        .style('pointer-events', 'none');
      // lane label
      g.append('text')
        .text(name)
        .attr('x', 8)
        .attr('y', y + LANE_BREADTH / 2)
        .attr('dominant-baseline', 'central')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .style('fill', laneColor)
        .style('opacity', 0.8)
        .style('pointer-events', 'none');
    } else {
      const x = LABEL_SIZE + i * LANE_BREADTH;
      g.append('rect')
        .attr('x', x).attr('y', 0)
        .attr('width', LANE_BREADTH).attr('height', height)
        .style('fill', hexToRgba(laneColor, isDark ? 0.06 : 0.04))
        .style('pointer-events', 'none');
      g.append('text')
        .text(name)
        .attr('x', x + LANE_BREADTH / 2)
        .attr('y', 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .style('fill', laneColor)
        .style('opacity', 0.8)
        .style('pointer-events', 'none');
    }
  });

  // ── Arrow marker ─────────────────────────────────────────────────────────
  svg.append('defs').append('marker')
    .attr('id', 'sb-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .style('fill', 'var(--viz-edge)');

  // ── Edges ─────────────────────────────────────────────────────────────────
  g.selectAll('path.sb-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'sb-edge')
    .attr('d', d => {
      const s = positions.get(d.source) ?? { x: 0, y: 0 };
      const t = positions.get(d.target) ?? { x: 0, y: 0 };
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      return `M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`;
    })
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'influences' ? '5,4' : null)
    .attr('marker-end', d => d.type !== 'influences' ? 'url(#sb-arrow)' : null);

  // ── Node groups ────────────────────────────────────────────────────────────
  const nodeG = g.selectAll('g.sb-node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'sb-node')
    .attr('transform', d => {
      const pos = positions.get(d.id) ?? { x: 0, y: 0 };
      return `translate(${pos.x},${pos.y})`;
    });

  nodeG.each(function(d) {
    const group = d3.select(this);
    const laneColor = themeColorForMode(d.theme ?? 'Main', isDark);
    const role = d.storyRole;
    let fill: string;
    let stroke: string;

    if (role === 'conflict') {
      fill = hexToRgba(isDark ? CONFLICT_COLORS.dark : CONFLICT_COLORS.light, 0.85);
      stroke = isDark ? CONFLICT_COLORS.dark : CONFLICT_COLORS.light;
    } else if (role === 'resolution') {
      fill = hexToRgba(isDark ? RESOLUTION_COLORS.dark : RESOLUTION_COLORS.light, 0.85);
      stroke = isDark ? RESOLUTION_COLORS.dark : RESOLUTION_COLORS.light;
    } else {
      fill = hexToRgba(laneColor, 0.2);
      stroke = laneColor;
    }

    if (role === 'event') {
      // Diamond
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', diamondPath(0, 0, SCENE_W * 0.6, SCENE_H))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'conflict') {
      // Hexagon
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', hexPath(0, 0, SCENE_H / 2 + 2))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'resolution') {
      // Pill
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -SCENE_W / 2).attr('y', -SCENE_H / 2)
        .attr('width', SCENE_W).attr('height', SCENE_H)
        .attr('rx', SCENE_H / 2).attr('ry', SCENE_H / 2)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else {
      // Wide rect (scene and default)
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -SCENE_W / 2).attr('y', -SCENE_H / 2)
        .attr('width', SCENE_W).attr('height', SCENE_H)
        .attr('rx', 6).attr('ry', 6)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    }

    // Label
    group.append('text')
      .text(truncate(d.label, 16))
      .attr('text-anchor', 'middle')
      .attr('y', d.details && (d.weight ?? 0) >= 0.65 ? -6 : 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', d.narrativeRole === 'central' ? '600' : '400')
      .style('fill', 'var(--text-primary)')
      .style('pointer-events', 'none');

    // Short detail snippet inside node for important scenes
    if (d.details && (d.weight ?? 0) >= 0.65 && role !== 'event') {
      group.append('text')
        .text(truncate(d.details, 22))
        .attr('text-anchor', 'middle')
        .attr('y', 10)
        .attr('dominant-baseline', 'central')
        .attr('font-size', '8px')
        .style('fill', 'var(--text-tertiary)')
        .style('pointer-events', 'none');
    }
  });
}
```

**Step 2: Type check + run all tests**

```bash
npm run check
npx vitest run
# expected: all pass
```

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/renderers/storyboard.ts
git commit -m "feat: add storyboard renderer — named branching lanes with orientation support"
```

---

## Task 8: Add `storyboardOrientation` to visualization store

**Files:**
- Modify: `src/lib/stores/visualization.ts`

**Step 1: Update `src/lib/stores/visualization.ts`**

Add `storyboardOrientation` to `VizState` and expose a setter:

```ts
import { writable } from 'svelte/store';
import type { VisualizationSchema, VisualizationType } from '$lib/types';

interface VizState {
  current: VisualizationSchema | null;
  loading: boolean;
  error: string | null;
  vizType: VisualizationType | null;
  storyboardOrientation: 'horizontal' | 'vertical';
}

function createVisualizationStore() {
  const { subscribe, set, update } = writable<VizState>({
    current: null,
    loading: false,
    error: null,
    vizType: null,
    storyboardOrientation: 'horizontal'
  });

  function setLoading() {
    update(s => ({ ...s, loading: true, error: null }));
  }

  function setVisualization(viz: VisualizationSchema) {
    set({ current: viz, loading: false, error: null, vizType: viz.type, storyboardOrientation: 'horizontal' });
  }

  function setError(error: string) {
    update(s => ({ ...s, loading: false, error }));
  }

  function setVizType(type: VisualizationType) {
    update(s => ({
      ...s,
      vizType: type,
      current: s.current ? { ...s.current, type } : null
    }));
  }

  function setStoryboardOrientation(orientation: 'horizontal' | 'vertical') {
    update(s => ({
      ...s,
      storyboardOrientation: orientation,
      current: s.current ? {
        ...s.current,
        renderOptions: { ...s.current.renderOptions, orientation }
      } : null
    }));
  }

  function clear() {
    set({ current: null, loading: false, error: null, vizType: null, storyboardOrientation: 'horizontal' });
  }

  return { subscribe, setLoading, setVisualization, setError, setVizType, setStoryboardOrientation, clear };
}

export const vizStore = createVisualizationStore();
```

**Step 2: Type check**

```bash
npm run check
# expected: no errors
```

**Step 3: Commit**

```bash
git add src/lib/stores/visualization.ts
git commit -m "feat: add storyboardOrientation to visualization store"
```

---

## Task 9: Update LLM prompts for new visualization types

**Files:**
- Modify: `src/lib/llm/prompts.ts`

The current `SYSTEM_PROMPT` is a single constant string. We need type-specific prompts for `logicalflow` and `storyboard`, plus a `buildSystemPrompt(vizType?)` function.

**Step 1: Replace `src/lib/llm/prompts.ts`**

```ts
import type { VisualizationType } from '$lib/types';

const BASE_SCHEMA_DOC = `You MUST respond with ONLY valid JSON — no markdown, no explanation:

{
  "type": "<visualization-type>",
  "title": "Short title",
  "description": "One-sentence summary",
  "nodes": [
    {
      "id": "unique-id",
      "label": "Display Label",
      "details": "1-2 sentences describing this node's role",
      "weight": 0.8,
      "theme": "short cluster/lane label",
      "narrativeRole": "central | supporting | contextual | outcome"
    }
  ],
  "edges": [
    {
      "source": "node-id",
      "target": "node-id",
      "label": "relationship label",
      "type": "<edge-type>",
      "strength": 0.7
    }
  ],
  "metadata": {
    "concepts": ["key", "concepts"],
    "relationships": ["Human-readable relationship summary sentences"]
  }
}`;

export const SYSTEM_PROMPT = `You are a concept visualization assistant. Given explanatory text, extract concepts and relationships, then output structured JSON.

${BASE_SCHEMA_DOC}

Field guidance:
- "weight" (0.0–1.0): how central is this concept to the text?
- "theme": a short thematic cluster label grouping related nodes
- "narrativeRole": "central" = main subject; "supporting" = key actors; "contextual" = background; "outcome" = results
- "strength" on edges (0.0–1.0): how explicit and strong is this relationship?
- "details": 1-2 sentences on this concept's specific role in the text

Choose the visualization type that best fits the content:
- "graph": interconnected concepts with many-to-many relationships
- "tree": hierarchical knowledge with clear parent-child structure
- "flowchart": sequential processes or decision flows
- "hierarchy": taxonomies or classification systems

Rules:
- Every node must have a unique id, label, weight, theme, narrativeRole, and details
- Every edge must reference valid node ids and include a strength value
- Include 5–15 nodes depending on content complexity
- Exactly one or two nodes should have narrativeRole "central"
- Respond with ONLY the JSON object`;

const LOGICAL_FLOW_PROMPT = `You are a concept visualization assistant specializing in argument and reasoning analysis. Extract the logical structure of the text as JSON.

${BASE_SCHEMA_DOC}

This visualization type is "logicalflow". Every node MUST include:
- "logicalRole": one of "premise" | "inference" | "conclusion" | "evidence" | "objection"
- "weight": certainty/support strength (1.0 = well-established fact, 0.2 = speculative)
- "theme": short argument strand label (e.g. "economic argument", "ethical case", "counterpoint")
- "details": 1-2 sentences explaining this node's logical role

logicalRole guidance:
- "premise": a fact, assumption, or assertion taken as given
- "evidence": data, examples, or citations supporting a premise
- "inference": a reasoning step derived from premises
- "conclusion": the main claim being argued for
- "objection": a counterargument or challenge to the reasoning

Edge types MUST come from: "supports" | "contradicts" | "derives" | "qualifies"
- "supports": this node backs up the target
- "contradicts": this node challenges or negates the target
- "derives": the target is logically derived from this node
- "qualifies": this node adds conditions or limits to the target

Rules:
- At least one "conclusion" node with narrativeRole "central"
- Objections should have edges of type "contradicts" to what they challenge
- Include 5–15 nodes
- Respond with ONLY the JSON object`;

const STORYBOARD_PROMPT = `You are a concept visualization assistant specializing in narrative analysis. Extract the story structure of the text as JSON.

${BASE_SCHEMA_DOC}

This visualization type is "storyboard". Every node MUST include:
- "storyRole": one of "scene" | "event" | "conflict" | "resolution"
- "theme": the story thread or character arc name — this becomes the swim lane label
  (e.g. "Main Story", "Hero Arc", "Villain Arc", "Subplot")
- "weight": narrative importance (1.0 = pivotal, 0.2 = minor beat)
- "narrativeRole": "central" for protagonist arc nodes, "outcome" for resolutions
- "details": 1-2 sentences describing what happens in this scene/event

storyRole guidance:
- "scene": a narrative beat or episode
- "event": a pivotal moment that changes the story direction
- "conflict": a moment of tension, opposition, or crisis
- "resolution": a moment of resolution, revelation, or outcome

Edge types MUST come from: "leads_to" | "branches_to" | "converges" | "influences"
- "leads_to": direct sequential narrative flow
- "branches_to": story splits into an alternate path or new arc
- "converges": two paths rejoin
- "influences": cross-arc cause-and-effect (use for cross-lane connections)

Rules:
- Use "theme" to group nodes into named story threads (lanes)
- Nodes without a clear arc belong to "Main Story"
- Include 5–15 nodes
- Respond with ONLY the JSON object`;

export function buildSystemPrompt(vizType?: VisualizationType | null): string {
  if (vizType === 'logicalflow') return LOGICAL_FLOW_PROMPT;
  if (vizType === 'storyboard') return STORYBOARD_PROMPT;
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(text: string): string {
  return `Analyze the following text and create a concept visualization:\n\n${text}`;
}
```

**Step 2: Update `src/lib/llm/client.ts`** to accept an optional `vizType`:

```ts
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { parseVisualizationResponse } from './parser';
import type { VisualizationSchema, VisualizationType } from '$lib/types';

interface LLMClientConfig {
  endpoint: string;
  model: string;
}

export async function generateVisualization(
  text: string,
  config: LLMClientConfig,
  vizType?: VisualizationType | null
): Promise<VisualizationSchema> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(vizType) },
        { role: 'user', content: buildUserPrompt(text) }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');

  return parseVisualizationResponse(content);
}
```

**Step 3: Update `src/lib/extractors/llm.ts`** to forward `vizType`:

```ts
import { generateVisualization } from '$lib/llm/client';
import type { VisualizationSchema, VisualizationType } from '$lib/types';
import type { ConceptExtractor } from './types';

interface LLMConfig {
  endpoint: string;
  model: string;
}

export class LLMExtractor implements ConceptExtractor {
  id = 'llm';
  name = 'LLM';
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async extract(text: string, vizType?: VisualizationType | null): Promise<VisualizationSchema> {
    return generateVisualization(text, this.config, vizType);
  }

  updateConfig(config: LLMConfig) {
    this.config = config;
  }
}
```

**Step 4: Check `src/lib/extractors/types.ts`** to ensure the `ConceptExtractor` interface `extract` signature is compatible (add optional `vizType` param if needed):

```bash
cat src/lib/extractors/types.ts
```

If `extract` is typed as `(text: string) => Promise<VisualizationSchema>`, update it to:
```ts
extract(text: string, vizType?: VisualizationType | null): Promise<VisualizationSchema>;
```

**Step 5: Type check + tests**

```bash
npm run check
npx vitest run
# expected: all pass
```

**Step 6: Commit**

```bash
git add src/lib/llm/prompts.ts src/lib/llm/client.ts src/lib/extractors/llm.ts src/lib/extractors/types.ts
git commit -m "feat: add type-specific LLM prompts for logicalflow and storyboard"
```

---

## Task 10: Add cache methods to `filesStore`

**Files:**
- Modify: `src/lib/stores/files.ts`

**Step 1: Add `updateCachedSchema` to the store** (after `updateVisualization`, before `updateSettings`):

```ts
async function updateCachedSchema(
  id: string,
  vizType: VisualizationType,
  schema: VisualizationSchema,
  contentHash: string
) {
  await db.files.where('id').equals(id).modify((file: ConceptFile) => {
    if (!file.cachedSchemas) file.cachedSchemas = {};
    file.cachedSchemas[vizType] = { schema, contentHash };
  });
  update(s => ({
    ...s,
    files: s.files.map(f => {
      if (f.id !== id) return f;
      const cachedSchemas = { ...(f.cachedSchemas ?? {}), [vizType]: { schema, contentHash } };
      return { ...f, cachedSchemas };
    })
  }));
}

async function clearCachedSchema(id: string, vizType: VisualizationType) {
  await db.files.where('id').equals(id).modify((file: ConceptFile) => {
    if (file.cachedSchemas) delete file.cachedSchemas[vizType];
  });
  update(s => ({
    ...s,
    files: s.files.map(f => {
      if (f.id !== id) return f;
      const cachedSchemas = { ...(f.cachedSchemas ?? {}) };
      delete cachedSchemas[vizType];
      return { ...f, cachedSchemas };
    })
  }));
}
```

Add both to the return object of `createFilesStore`.

Also add the missing imports at the top:
```ts
import type { ConceptFile, VisualizationSchema, VisualizationType } from '$lib/types';
```
(replaces the existing import that lacks `VisualizationType`).

**Step 2: Type check**

```bash
npm run check
# expected: no errors
```

**Step 3: Commit**

```bash
git add src/lib/stores/files.ts
git commit -m "feat: add updateCachedSchema and clearCachedSchema to filesStore"
```

---

## Task 11: Wire cache check into `handleVisualize` in `+page.svelte`

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add `hashContent` import** at the top of the `<script>`:

```ts
import { hashContent } from '$lib/utils/hash';
```

**Step 2: Update `VIZ_TYPES` array** to include new types:

```ts
const VIZ_TYPES: VisualizationType[] = ['graph', 'tree', 'flowchart', 'hierarchy', 'logicalflow', 'storyboard'];
```

**Step 3: Add `isFromCache` reactive state** after the existing `engineToast` state:

```ts
let isFromCache = $state(false);
```

**Step 4: Replace `handleVisualize`** with cache-aware version:

```ts
async function handleVisualize() {
  if (!activeFile || !activeFile.text.trim()) return;

  const vizType = $vizStore.vizType ?? 'graph';
  const contentHash = hashContent(activeFile.text);
  const cached = activeFile.cachedSchemas?.[vizType];

  if (cached && cached.contentHash === contentHash) {
    // Cache hit — use stored schema directly
    isFromCache = true;
    vizStore.setVisualization(cached.schema);
    return;
  }

  isFromCache = false;
  vizStore.setLoading();
  try {
    const engineId = $settingsStore.extractionEngine as ExtractionEngineId;
    const engine = registry.getEngine(engineId);
    const viz = await engine.extract(activeFile.text, vizType);
    vizStore.setVisualization(viz);
    await filesStore.updateVisualization(activeFile.id, viz);
    await filesStore.updateCachedSchema(activeFile.id, vizType, viz, contentHash);
  } catch (err) {
    vizStore.setError(err instanceof Error ? err.message : 'Unknown error');
  }
}
```

**Step 5: Add `handleReextract`** for the re-extract button:

```ts
async function handleReextract() {
  if (!activeFile) return;
  const vizType = $vizStore.vizType ?? 'graph';
  await filesStore.clearCachedSchema(activeFile.id, vizType);
  isFromCache = false;
  await handleVisualize();
}
```

**Step 6: Pass `isFromCache` and `onReextract` to `EditorPane`**

In the `{#snippet editor()}` block, update `<EditorPane ...>`:

```svelte
<EditorPane
  ...
  {isFromCache}
  onReextract={handleReextract}
>
```

**Step 7: Type check**

```bash
npm run check
# expected: prop type errors until EditorPane is updated in Task 12
```

**Step 8: Commit** (after Task 12 completes and type check passes — see note at end of Task 12)

---

## Task 12: Add cache badge, re-extract button, and H/V toggle to `EditorPane` and `TextEditor`

**Files:**
- Modify: `src/lib/components/editor/EditorPane.svelte`
- Modify: `src/lib/components/editor/TextEditor.svelte`

**Step 1: Update `EditorPane.svelte` Props interface**

Add to the `interface Props`:
```ts
isFromCache?: boolean;
onReextract?: () => void;
```

Pass them through to `TextEditor`:
```svelte
<TextEditor
  {text}
  onchange={onTextChange}
  onvisualize={onVisualize}
  {loading}
  {autoSend}
  {onAutoSendToggle}
  {file}
  {isFromCache}
  {onReextract}
/>
```

Also add orientation toggle above `<TextEditor>` when visualization is a storyboard. Add these imports at the top of the script:
```ts
import { vizStore } from '$lib/stores/visualization';
```

Add the toggle in the template, inside the `<Panel title="Input" fill>` block, before `<TextEditor>`:
```svelte
{#if $vizStore.vizType === 'storyboard'}
  <div class="flex items-center gap-2 px-4 pt-2" style="color: var(--text-tertiary)">
    <span class="text-xs">Orientation:</span>
    <button
      onclick={() => vizStore.setStoryboardOrientation($vizStore.storyboardOrientation === 'horizontal' ? 'vertical' : 'horizontal')}
      class="text-xs px-2 py-0.5 rounded font-mono border"
      style="border-color: var(--border); color: var(--text-secondary)"
    >
      {$vizStore.storyboardOrientation === 'horizontal' ? 'H' : 'V'}
    </button>
  </div>
{/if}
```

**Step 2: Update `TextEditor.svelte` Props interface**

Add to `interface Props`:
```ts
isFromCache?: boolean;
onReextract?: () => void;
```

Add to `let { ... }`:
```ts
let { text, onchange, onvisualize, loading, autoSend, onAutoSendToggle, file, isFromCache = false, onReextract }: Props = $props();
```

**Step 3: Update the Visualize button row in `TextEditor.svelte`**

Replace the button `<div class="flex items-center gap-2">` block with:

```svelte
<div class="flex items-center gap-2">
  {#if isFromCache}
    <span class="text-xs px-2 py-0.5 rounded-full" style="background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent)">
      cached
    </span>
    {#if onReextract}
      <button
        onclick={onReextract}
        disabled={loading}
        title="Re-extract from LLM"
        class="p-1 rounded opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
        style="color: var(--text-tertiary)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    {/if}
  {/if}
  <button
    onclick={onvisualize}
    disabled={loading || !text.trim()}
    class="px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    style="background: var(--accent)"
  >
    {loading ? 'Generating...' : 'Visualize'}
    {#if !loading}
      <kbd class="ml-1.5 text-[10px] opacity-70">Cmd+Enter</kbd>
    {/if}
  </button>
</div>
```

**Step 4: Full type check**

```bash
npm run check
# expected: no errors
```

**Step 5: Run all tests**

```bash
npx vitest run
# expected: all pass
```

**Step 6: Commit Tasks 11 + 12 together**

```bash
git add src/routes/+page.svelte src/lib/components/editor/EditorPane.svelte src/lib/components/editor/TextEditor.svelte
git commit -m "feat: wire cache check, re-extract button, and storyboard orientation toggle"
```

---

## Task 13: Final integration smoke test

**Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in browser.

**Step 2: Test logical flow**

1. Cycle viz type to `logicalflow`
2. Paste an argumentative paragraph (e.g. a philosophical argument)
3. Click Visualize
4. Verify: columnar layout with distinct shapes per role, colored edges, `"cached"` badge appears
5. Click Visualize again without changing text → verify no LLM call (same result instantly)
6. Edit text → click Visualize → verify LLM is called again, cache badge disappears then reappears

**Step 3: Test storyboard**

1. Cycle viz type to `storyboard`
2. Paste a story synopsis
3. Click Visualize
4. Verify: named lane strips visible, scene cards in lanes, branching connectors
5. Click `H/V` toggle → verify layout rotates to vertical
6. Click `H/V` again → verify it returns to horizontal

**Step 4: Test hover on new shapes**

1. Hover over a hexagon (inference node in logicalflow) → NodeTooltip should appear
2. Hover over a diamond (event node in storyboard) → NodeTooltip should appear
3. Verify existing graph/tree/flowchart/hierarchy hover still works

**Step 5: Run full test suite one final time**

```bash
npx vitest run
npm run check
# expected: all pass, no type errors
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete new visualizations — logicalflow, storyboard, and file caching"
```

---

## Summary of all files changed

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `logicalflow`/`storyboard` to `VisualizationType`; add `LogicalRole`, `StoryRole` types; add `logicalRole`, `storyRole` to node; add `renderOptions` to schema; add `cachedSchemas` to `ConceptFile` |
| `src/lib/types.test.ts` | NEW: type-level tests |
| `src/lib/utils/hash.ts` | NEW: `hashContent()` djb2 hash |
| `src/lib/utils/hash.test.ts` | NEW: hash utility tests |
| `src/lib/components/visualizer/renderers/utils.ts` | Add `logicalRoleColor()`, `edgeSemanticColor()` |
| `src/lib/components/visualizer/renderers/utils.test.ts` | NEW: color helper tests |
| `src/lib/components/visualizer/renderers/graph.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/renderers/tree.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/renderers/flowchart.ts` | Add `node-shape` class to rects |
| `src/lib/components/visualizer/renderers/hierarchy.ts` | Add `node-shape` class to circles |
| `src/lib/components/visualizer/renderers/logicalflow.ts` | NEW: logical flow renderer |
| `src/lib/components/visualizer/renderers/storyboard.ts` | NEW: storyboard renderer |
| `src/lib/components/visualizer/renderers/index.ts` | Register new renderers |
| `src/lib/components/visualizer/VisualizerCanvas.svelte` | Update hover selector to `.node-shape:not(.glow)` |
| `src/lib/stores/visualization.ts` | Add `storyboardOrientation` state + setter |
| `src/lib/stores/files.ts` | Add `updateCachedSchema()`, `clearCachedSchema()` |
| `src/lib/llm/prompts.ts` | Add `LOGICAL_FLOW_PROMPT`, `STORYBOARD_PROMPT`, `buildSystemPrompt(vizType)` |
| `src/lib/llm/client.ts` | Accept optional `vizType` parameter |
| `src/lib/extractors/llm.ts` | Forward `vizType` to client |
| `src/lib/extractors/types.ts` | Update `extract` signature to accept `vizType` |
| `src/routes/+page.svelte` | Cache check in `handleVisualize`, `handleReextract`, `isFromCache` state, extended `VIZ_TYPES` |
| `src/lib/components/editor/EditorPane.svelte` | Pass `isFromCache`/`onReextract` to TextEditor; add H/V orientation toggle |
| `src/lib/components/editor/TextEditor.svelte` | Add cache badge + re-extract icon button |
