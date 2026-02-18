# Rich Storytelling Visualizations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform plain uniform-node visualizations into rich, IIB-inspired storytelling canvases with semantic visual encoding, inline details, curved edges, and hover/click interactivity.

**Architecture:** Expand `VisualizationSchema` with semantic fields (`weight`, `theme`, `narrativeRole`, `strength`). Create a shared renderer utilities module. Update all 4 renderers + LLM prompt to use the new fields. Add a `NodeTooltip.svelte` overlay wired through `VisualizerCanvas`. Remove the right-side HUD control cluster from the canvas.

**Tech Stack:** D3.js v7, Svelte 5 runes, TypeScript, Vitest + jsdom

---

## Reference Files

- Design doc: `docs/plans/2026-02-18-rich-visualizations-design.md`
- Types: `src/lib/types.ts`
- LLM prompt: `src/lib/llm/prompts.ts`
- Renderers: `src/lib/components/visualizer/renderers/`
- Canvas: `src/lib/components/visualizer/VisualizerCanvas.svelte`
- Controls: `src/lib/components/controls/GamepadControls.svelte`
- Editor pane: `src/lib/components/editor/EditorPane.svelte`

---

## Task 1: Expand VisualizationSchema types

**Files:**
- Modify: `src/lib/types.ts`

No runtime tests needed — these are TypeScript type-only changes. Run `npm run check` to verify.

**Step 1: Add new fields to VisualizationNode and VisualizationEdge**

Open `src/lib/types.ts` and update the interfaces to:

```typescript
export type VisualizationType = 'graph' | 'tree' | 'flowchart' | 'hierarchy';

export type NarrativeRole = 'central' | 'supporting' | 'contextual' | 'outcome';

export interface VisualizationNode {
  id: string;
  label: string;
  type?: string;
  group?: string;
  details?: string;
  // New semantic fields
  weight?: number;        // 0–1 importance/centrality → node size
  theme?: string;         // cluster label → color family
  narrativeRole?: NarrativeRole;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
  strength?: number;      // 0–1 relationship strength → line thickness
}
```

Leave all other types (`VisualizationSchema`, `ConceptFile`, `AppSettings`) unchanged.

**Step 2: Verify type-check passes**

```bash
npm run check
```

Expected: no new type errors.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add weight, theme, narrativeRole, strength to visualization schema"
```

---

## Task 2: Create shared renderer utilities module

**Files:**
- Create: `src/lib/components/visualizer/renderers/utils.ts`
- Create: `src/lib/components/visualizer/renderers/utils.test.ts`

All 4 renderers share the same color palette and sizing functions. This module centralises them.

**Step 1: Write the failing tests**

Create `src/lib/components/visualizer/renderers/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { themeColor, THEME_COLORS, nodeRadius, edgeThickness, edgeOpacity, truncate } from './utils';

describe('themeColor', () => {
  it('returns first palette color when theme is undefined', () => {
    expect(themeColor(undefined)).toBe(THEME_COLORS[0]);
  });

  it('returns a color from the palette for any string', () => {
    const color = themeColor('process');
    expect(THEME_COLORS).toContain(color);
  });

  it('returns the same color for the same input (deterministic)', () => {
    expect(themeColor('emotion')).toBe(themeColor('emotion'));
  });

  it('falls back to group when theme is undefined', () => {
    const a = themeColor(undefined, 'g1');
    const b = themeColor(undefined, 'g1');
    expect(a).toBe(b);
    expect(THEME_COLORS).toContain(a);
  });
});

describe('nodeRadius', () => {
  it('returns 12 for weight 0', () => {
    expect(nodeRadius(0)).toBe(12);
  });

  it('returns 40 for weight 1', () => {
    expect(nodeRadius(1)).toBe(40);
  });

  it('returns 26 for undefined (default 0.5)', () => {
    expect(nodeRadius(undefined)).toBe(26);
  });

  it('clamps correctly between 12 and 40', () => {
    expect(nodeRadius(0.5)).toBeGreaterThanOrEqual(12);
    expect(nodeRadius(0.5)).toBeLessThanOrEqual(40);
  });
});

describe('edgeThickness', () => {
  it('returns 1 for strength 0', () => {
    expect(edgeThickness(0)).toBe(1);
  });

  it('returns 4 for strength 1', () => {
    expect(edgeThickness(1)).toBe(4);
  });

  it('returns 2.5 for undefined (default 0.5)', () => {
    expect(edgeThickness(undefined)).toBeCloseTo(2.5);
  });
});

describe('edgeOpacity', () => {
  it('returns 0.4 for strength 0', () => {
    expect(edgeOpacity(0)).toBeCloseTo(0.4);
  });

  it('returns 0.9 for strength 1', () => {
    expect(edgeOpacity(1)).toBeCloseTo(0.9);
  });
});

describe('truncate', () => {
  it('returns empty string for undefined input', () => {
    expect(truncate(undefined, 20)).toBe('');
  });

  it('truncates strings longer than max with ellipsis', () => {
    const result = truncate('hello world foo bar baz', 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns unchanged string when shorter than max', () => {
    expect(truncate('hello', 20)).toBe('hello');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/components/visualizer/renderers/utils.test.ts
```

Expected: FAIL — `utils.ts` does not exist yet.

**Step 3: Create the utils module**

Create `src/lib/components/visualizer/renderers/utils.ts`:

```typescript
// Soft editorial palette inspired by InformationIsBeautiful
export const THEME_COLORS = [
  '#7b9bcd', // Slate Blue
  '#7bae9d', // Sage Green
  '#e07b7b', // Coral Rose
  '#d4a85a', // Warm Amber
  '#a07bcd', // Lavender
  '#5aacbc', // Teal
  '#c4a97d', // Sand
];

/** Deterministically map a theme string to a palette color. */
export function themeColor(theme: string | undefined, fallback?: string): string {
  const key = theme ?? fallback ?? '';
  if (!key) return THEME_COLORS[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  }
  return THEME_COLORS[hash % THEME_COLORS.length];
}

/** Node radius from weight (0–1). Returns 12–40px range. */
export function nodeRadius(weight: number | undefined): number {
  return 12 + (weight ?? 0.5) * 28;
}

/** Edge stroke width from strength (0–1). Returns 1–4px range. */
export function edgeThickness(strength: number | undefined): number {
  return 1 + (strength ?? 0.5) * 3;
}

/** Edge opacity from strength (0–1). Returns 0.4–0.9 range. */
export function edgeOpacity(strength: number | undefined): number {
  return 0.4 + (strength ?? 0.5) * 0.5;
}

/** Truncate a string to max characters, appending ellipsis. */
export function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/** Darken a hex color by a factor (0–1). */
export function darkenColor(hex: string, amount = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/** Hex color to rgba string. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/components/visualizer/renderers/utils.test.ts
```

Expected: all 11 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/components/visualizer/renderers/utils.ts src/lib/components/visualizer/renderers/utils.test.ts
git commit -m "feat: add shared renderer utilities (palette, sizing, truncation)"
```

---

## Task 3: Expand the LLM prompt

**Files:**
- Modify: `src/lib/llm/prompts.ts`
- Modify: `src/lib/llm/parser.test.ts` (add prompt content test)

**Step 1: Write a failing test for the new prompt fields**

Open `src/lib/llm/parser.test.ts` and add at the top level (outside existing describe blocks):

```typescript
import { SYSTEM_PROMPT } from './prompts';

describe('SYSTEM_PROMPT', () => {
  it('requests the weight field', () => {
    expect(SYSTEM_PROMPT).toContain('"weight"');
  });

  it('requests the theme field', () => {
    expect(SYSTEM_PROMPT).toContain('"theme"');
  });

  it('requests the narrativeRole field', () => {
    expect(SYSTEM_PROMPT).toContain('"narrativeRole"');
  });

  it('requests the strength field on edges', () => {
    expect(SYSTEM_PROMPT).toContain('"strength"');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/llm/parser.test.ts
```

Expected: the 4 new tests FAIL.

**Step 3: Rewrite the system prompt**

Replace the entire content of `src/lib/llm/prompts.ts` with:

```typescript
export const SYSTEM_PROMPT = `You are a concept visualization assistant. Given explanatory text, extract concepts and relationships, then output structured JSON.

You MUST respond with ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "type": "graph" | "tree" | "flowchart" | "hierarchy",
  "title": "Short title for the visualization",
  "description": "One-sentence summary of the content",
  "nodes": [
    {
      "id": "unique-id",
      "label": "Display Label",
      "type": "concept | process | decision | category | outcome",
      "group": "optional-group-name",
      "details": "1-2 sentences describing this concept's role in context",
      "weight": 0.8,
      "theme": "short cluster label (e.g. 'emotion', 'process', 'agent', 'outcome')",
      "narrativeRole": "central | supporting | contextual | outcome"
    }
  ],
  "edges": [
    {
      "source": "node-id",
      "target": "node-id",
      "label": "relationship label",
      "type": "causes | contains | precedes | relates | contrasts | transforms",
      "strength": 0.7
    }
  ],
  "metadata": {
    "concepts": ["list", "of", "key", "concepts"],
    "relationships": ["Human-readable relationship summary sentences"]
  }
}

Field guidance:
- "weight" (0.0–1.0): how central is this concept to the text? 1.0 = the main subject, 0.1 = background detail
- "theme": a short thematic cluster label grouping related nodes (e.g. "emotion", "structure", "process", "agent", "context")
- "narrativeRole": "central" = the main subject/protagonist; "supporting" = key actors or mechanisms; "contextual" = background or setting; "outcome" = results or consequences
- "strength" on edges (0.0–1.0): how explicit and strong is this relationship in the source text? 1.0 = directly stated, 0.2 = implied
- "details": write 1-2 sentences describing this concept's specific role in the context of the text, not just a generic definition

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

export function buildUserPrompt(text: string): string {
  return `Analyze the following text and create a concept visualization:\n\n${text}`;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/llm/parser.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/lib/llm/prompts.ts src/lib/llm/parser.test.ts
git commit -m "feat: expand LLM prompt to extract weight, theme, narrativeRole, strength"
```

---

## Task 4: Update graph renderer — visual encoding

**Files:**
- Modify: `src/lib/components/visualizer/renderers/graph.ts`
- Modify: `src/lib/components/visualizer/renderers/graph.test.ts`

Replace uniform circles + straight lines with: variable-size nodes (weight), theme colors, glow rings for central nodes, curved bezier edge paths, edge thickness/opacity from strength, inline detail snippets for prominent nodes.

**Step 1: Update the failing tests first**

Open `graph.test.ts` and replace the entire file:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderGraph } from './graph';
import type { VisualizationSchema } from '$lib/types';

function makeSvg() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  svg.setAttribute('width', '800');
  svg.setAttribute('height', '600');
  dom.window.document.body.appendChild(svg);
  return svg;
}

const baseSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test Graph',
  description: 'A test',
  nodes: [
    { id: 'a', label: 'Node A', group: 'g1', weight: 1.0, theme: 'process', narrativeRole: 'central' },
    { id: 'b', label: 'Node B', group: 'g1', weight: 0.5, theme: 'process', narrativeRole: 'supporting' },
    { id: 'c', label: 'Node C', group: 'g2', weight: 0.0, theme: 'context', narrativeRole: 'contextual' },
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects', strength: 0.8 },
    { source: 'b', target: 'c', label: 'leads to', strength: 0.3 },
  ],
  metadata: { concepts: ['Node A', 'Node B', 'Node C'], relationships: [] }
};

describe('renderGraph', () => {
  let svg: SVGSVGElement;

  beforeEach(() => { svg = makeSvg(); });

  it('renders 3 nodes (circles) and 0 straight lines', () => {
    renderGraph(svg, baseSchema);
    // Edges are now curved paths, not lines
    const circles = svg.querySelectorAll('circle:not(.glow)');
    const lines = svg.querySelectorAll('line');
    expect(circles.length).toBe(3);
    expect(lines.length).toBe(0);
  });

  it('renders curved path edges instead of lines', () => {
    renderGraph(svg, baseSchema);
    const paths = svg.querySelectorAll('path.edge');
    expect(paths.length).toBe(2);
  });

  it('renders node labels', () => {
    renderGraph(svg, baseSchema);
    const texts = Array.from(svg.querySelectorAll('text')).map(t => t.textContent);
    expect(texts).toContain('Node A');
    expect(texts).toContain('Node B');
  });

  it('renders variable-size circles based on node weight', () => {
    renderGraph(svg, baseSchema);
    const circles = Array.from(svg.querySelectorAll('circle:not(.glow)'));
    const radii = circles.map(c => parseFloat(c.getAttribute('r') ?? '0'));
    // Weight 1.0 node should be larger than weight 0.0 node
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });

  it('renders a glow ring for central-role nodes', () => {
    renderGraph(svg, baseSchema);
    const glowCircles = svg.querySelectorAll('circle.glow');
    expect(glowCircles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders with legacy schema (no new fields) without throwing', () => {
    const legacySchema: VisualizationSchema = {
      type: 'graph',
      title: 'Legacy',
      description: '',
      nodes: [
        { id: 'x', label: 'X', group: 'g1' },
        { id: 'y', label: 'Y' },
      ],
      edges: [{ source: 'x', target: 'y' }],
      metadata: { concepts: [], relationships: [] }
    };
    expect(() => renderGraph(svg, legacySchema)).not.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/components/visualizer/renderers/graph.test.ts
```

Expected: "renders 3 nodes and 0 straight lines" FAIL, "renders curved path edges" FAIL, "renders variable-size circles" FAIL, "renders a glow ring" FAIL.

**Step 3: Rewrite graph.ts**

Replace the entire content of `src/lib/components/visualizer/renderers/graph.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, edgeThickness, edgeOpacity, hexToRgba, truncate } from './utils';

export function renderGraph(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');

  const nodes = schema.nodes.map(n => ({ ...n }));
  const edges = schema.edges.map(e => ({ ...e, source: e.source, target: e.target }));

  const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => {
      const sr = nodeRadius((d.source as any).weight);
      const tr = nodeRadius((d.target as any).weight);
      return 80 + sr + tr;
    }))
    .force('charge', d3.forceManyBody().strength((d: any) => -200 - nodeRadius(d.weight) * 8))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => nodeRadius(d.weight) + 10));

  const g = svg.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Click background to deselect
  svg.on('click', () => {
    node.style('opacity', 1);
    link.style('opacity', (e: any) => edgeOpacity(e.strength));
    glowRings.style('opacity', 0.25);
  });

  // ── Glow rings (behind nodes, only for central/outcome roles) ──
  const glowRings = g.append('g')
    .selectAll('circle.glow')
    .data(nodes.filter(n => n.narrativeRole === 'central' || n.narrativeRole === 'outcome'))
    .join('circle')
    .attr('class', 'glow')
    .attr('r', (d: any) => nodeRadius(d.weight) + 8)
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.25))
    .style('pointer-events', 'none');

  // ── Edges (curved bezier paths) ──
  const link = g.append('g')
    .selectAll('path.edge')
    .data(edges)
    .join('path')
    .attr('class', 'edge')
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', (d: any) => edgeThickness(d.strength))
    .style('opacity', (d: any) => edgeOpacity(d.strength))
    .attr('stroke-dasharray', (d: any) => d.type === 'contrasts' ? '5,4' : null);

  // ── Edge labels (only for strong edges) ──
  const edgeLabels = g.append('g')
    .selectAll('text')
    .data(edges.filter((e: any) => (e.strength ?? 0.5) > 0.5))
    .join('text')
    .text((d: any) => d.label || '')
    .attr('font-size', '9px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none');

  // ── Nodes ──
  const node = g.append('g')
    .selectAll('circle:not(.glow)')
    .data(nodes)
    .join('circle')
    .attr('r', d => nodeRadius(d.weight))
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.82))
    .style('stroke', d => themeColor(d.theme, d.group))
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .call(drag(simulation) as any)
    .on('click', function (event, d: any) {
      event.stopPropagation();
      const neighborIds = new Set<string>([d.id]);
      edges.forEach((e: any) => {
        if (e.source.id === d.id) neighborIds.add(e.target.id);
        if (e.target.id === d.id) neighborIds.add(e.source.id);
      });
      node.style('opacity', (n: any) => neighborIds.has(n.id) ? 1 : 0.12);
      link.style('opacity', (e: any) =>
        (e.source.id === d.id || e.target.id === d.id)
          ? edgeOpacity(e.strength)
          : 0.04
      );
      glowRings.style('opacity', (n: any) => neighborIds.has(n.id) ? 0.25 : 0.04);
    });

  // ── Node labels ──
  const labels = g.append('g')
    .selectAll('text.label')
    .data(nodes)
    .join('text')
    .attr('class', 'label')
    .text(d => d.label)
    .attr('font-size', (d: any) => nodeRadius(d.weight) >= 22 ? '11px' : '10px')
    .attr('font-weight', (d: any) => (d.narrativeRole === 'central') ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => nodeRadius(d.weight) >= 22 ? 4 : nodeRadius(d.weight) + 14)
    .style('pointer-events', 'none');

  // ── Detail snippets (for prominent nodes only) ──
  const detailSnippets = g.append('g')
    .selectAll('text.detail')
    .data(nodes.filter(n => (n.weight ?? 0.5) >= 0.65 && n.details))
    .join('text')
    .attr('class', 'detail')
    .text(d => truncate(d.details, 42))
    .attr('font-size', '9px')
    .style('fill', 'var(--text-tertiary)')
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none');

  function curvePath(d: any): string {
    const sx = d.source.x ?? 0, sy = d.source.y ?? 0;
    const tx = d.target.x ?? 0, ty = d.target.y ?? 0;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = Math.min(dist * 0.22, 55);
    const mx = (sx + tx) / 2 - (dy / dist) * offset;
    const my = (sy + ty) / 2 + (dx / dist) * offset;
    return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
  }

  simulation.on('tick', () => {
    link.attr('d', (d: any) => curvePath(d));

    edgeLabels
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 6);

    glowRings
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y);

    detailSnippets
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y + nodeRadius(d.weight) + 25);
  });
}

function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
  return d3.drag()
    .on('start', (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on('drag', (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/components/visualizer/renderers/graph.test.ts
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/components/visualizer/renderers/graph.ts src/lib/components/visualizer/renderers/graph.test.ts
git commit -m "feat: enrich graph renderer with variable sizing, theme colors, curved edges, glow rings"
```

---

## Task 5: Update tree renderer

**Files:**
- Modify: `src/lib/components/visualizer/renderers/tree.ts`

Replace uniform blue circles with variable-size theme-colored bubbles and styled bezier links.

**Step 1: Rewrite tree.ts**

Replace the entire content of `src/lib/components/visualizer/renderers/tree.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, hexToRgba } from './utils';

export function renderTree(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };

  const nodeMap = new Map(schema.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
  const childIds = new Set(schema.edges.map(e => e.target));
  const rootId = schema.nodes.find(n => !childIds.has(n.id))?.id || schema.nodes[0]?.id;

  for (const edge of schema.edges) {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) parent.children.push(child);
  }

  const rootData = nodeMap.get(rootId);
  if (!rootData) return;

  const root = d3.hierarchy(rootData);
  const treeLayout = d3.tree().size([
    width - margin.left - margin.right,
    height - margin.top - margin.bottom
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Links — smooth bezier curves
  g.selectAll('path.link')
    .data(root.links())
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.linkVertical<any, any>()
      .x((d: any) => d.x)
      .y((d: any) => d.y) as any)
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5)
    .style('opacity', 0.55);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

  nodeG.append('circle')
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme, d.data.group), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme, d.data.group))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', (d: any) => d.depth === 0 ? '13px' : '11px')
    .attr('font-weight', (d: any) => d.depth === 0 ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => nodeRadius(d.data.weight) + 14);
}
```

**Step 2: Run the full test suite to make sure nothing broke**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/renderers/tree.ts
git commit -m "feat: update tree renderer with variable bubble sizes and theme colors"
```

---

## Task 6: Update flowchart renderer — pill nodes and theme fills

**Files:**
- Modify: `src/lib/components/visualizer/renderers/flowchart.ts`

**Step 1: Rewrite flowchart.ts**

Replace the entire content:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, edgeThickness, edgeOpacity, hexToRgba, truncate } from './utils';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 44;
const GAP_X = 70;
const GAP_Y = 72;

export function renderFlowchart(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');

  // Topological sort for positioning
  const positions = new Map<string, { x: number; y: number }>();
  const inDegree = new Map<string, number>();
  schema.nodes.forEach(n => inDegree.set(n.id, 0));
  schema.edges.forEach(e => inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1));

  const queue = schema.nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  let row = 0;
  const visited = new Set<string>();

  while (queue.length > 0) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const col = i - (levelSize - 1) / 2;
      positions.set(nodeId, {
        x: width / 2 + col * (NODE_WIDTH + GAP_X),
        y: 60 + row * (NODE_HEIGHT + GAP_Y)
      });
      schema.edges
        .filter(e => e.source === nodeId)
        .forEach(e => {
          const deg = (inDegree.get(e.target) || 1) - 1;
          inDegree.set(e.target, deg);
          if (deg === 0) queue.push(e.target);
        });
    }
    row++;
  }
  schema.nodes.forEach(n => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: width / 2, y: 60 + row * (NODE_HEIGHT + GAP_Y) });
      row++;
    }
  });

  const g = svg.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'fc-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10).attr('refY', 0)
    .attr('markerWidth', 7).attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .style('fill', 'var(--viz-edge)');

  // Edges — curved bezier with variable thickness
  g.selectAll('path.fc-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'fc-edge')
    .attr('d', d => {
      const s = positions.get(d.source) || { x: 0, y: 0 };
      const t = positions.get(d.target) || { x: 0, y: 0 };
      const mx = (s.x + t.x) / 2;
      const my = (s.y + NODE_HEIGHT / 2 + t.y - NODE_HEIGHT / 2) / 2;
      return `M${s.x},${s.y + NODE_HEIGHT / 2} C${s.x},${my} ${t.x},${my} ${t.x},${t.y - NODE_HEIGHT / 2}`;
    })
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'contrasts' ? '6,4' : null)
    .attr('marker-end', 'url(#fc-arrow)');

  // Edge labels
  g.selectAll('text.fc-edge-label')
    .data(schema.edges.filter(e => (e.strength ?? 0.5) > 0.5))
    .join('text')
    .attr('class', 'fc-edge-label')
    .text(d => d.label || '')
    .attr('x', d => ((positions.get(d.source)?.x || 0) + (positions.get(d.target)?.x || 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y || 0) + (positions.get(d.target)?.y || 0)) / 2)
    .attr('font-size', '9px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle');

  // Node groups
  const nodeG = g.selectAll('g.node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => {
      const pos = positions.get(d.id) || { x: 0, y: 0 };
      return `translate(${pos.x - NODE_WIDTH / 2},${pos.y - NODE_HEIGHT / 2})`;
    });

  // Pill-shaped rects (rx = half height = full pill)
  nodeG.append('rect')
    .attr('width', NODE_WIDTH)
    .attr('height', NODE_HEIGHT)
    .attr('rx', NODE_HEIGHT / 2)
    .attr('ry', NODE_HEIGHT / 2)
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.82))
    .style('stroke', d => themeColor(d.theme, d.group))
    .attr('stroke-width', 1.5);

  // Label
  nodeG.append('text')
    .text(d => d.label)
    .attr('x', NODE_WIDTH / 2)
    .attr('y', NODE_HEIGHT / 2 - (d => d.details ? 5 : 0))
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '12px')
    .attr('font-weight', d => d.narrativeRole === 'central' ? '600' : '400')
    .style('fill', 'var(--text-primary)');

  // Detail snippet below label for central nodes
  nodeG.filter(d => !!d.details && (d.weight ?? 0) >= 0.6)
    .append('text')
    .text(d => truncate(d.details, 30))
    .attr('x', NODE_WIDTH / 2)
    .attr('y', NODE_HEIGHT / 2 + 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '8px')
    .style('fill', 'var(--text-tertiary)');
}
```

**Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/renderers/flowchart.ts
git commit -m "feat: flowchart renderer with pill nodes, theme fills, curved edges"
```

---

## Task 7: Update hierarchy renderer — radial dendrogram

**Files:**
- Modify: `src/lib/components/visualizer/renderers/hierarchy.ts`

Replace the horizontal tree with a radial dendrogram (concentric rings). Inspired by the "Being Defensive" circular layout.

**Step 1: Rewrite hierarchy.ts**

Replace the entire content:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, hexToRgba } from './utils';

export function renderHierarchy(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 90;

  // Build hierarchy
  const nodeMap = new Map(schema.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
  const childIds = new Set(schema.edges.map(e => e.target));
  const rootId = schema.nodes.find(n => !childIds.has(n.id))?.id || schema.nodes[0]?.id;

  for (const edge of schema.edges) {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) parent.children.push(child);
  }

  const rootData = nodeMap.get(rootId);
  if (!rootData) return;

  const root = d3.hierarchy(rootData);
  const treeLayout = d3.tree<any>()
    .size([2 * Math.PI, outerRadius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
  treeLayout(root as any);

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', `translate(${cx},${cy}) ${event.transform}`));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Radial links
  g.selectAll('path.radial-link')
    .data(root.links())
    .join('path')
    .attr('class', 'radial-link')
    .attr('d', d3.linkRadial<any, any>()
      .angle((d: any) => d.x)
      .radius((d: any) => d.y) as any)
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5)
    .style('opacity', 0.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => {
      const angle = d.x - Math.PI / 2;
      return `translate(${d.y * Math.cos(angle)},${d.y * Math.sin(angle)})`;
    });

  nodeG.append('circle')
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme, d.data.group), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme, d.data.group))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', (d: any) => d.depth === 0 ? '13px' : '10px')
    .attr('font-weight', (d: any) => d.depth === 0 ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', (d: any) => d.x < Math.PI ? 'start' : 'end')
    .attr('x', (d: any) => {
      const r = nodeRadius(d.data.weight) + 5;
      return d.x < Math.PI ? r : -r;
    })
    .attr('dy', 4);
}
```

**Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/renderers/hierarchy.ts
git commit -m "feat: redesign hierarchy renderer as radial dendrogram"
```

---

## Task 8: Create NodeTooltip component

**Files:**
- Create: `src/lib/components/visualizer/NodeTooltip.svelte`

This is a floating glass card that appears when hovering a node in the canvas. It receives the hovered node plus the full edges/nodes list to build a connection summary.

**Step 1: Create NodeTooltip.svelte**

```svelte
<script lang="ts">
  import type { VisualizationNode, VisualizationEdge } from '$lib/types';

  interface Props {
    node: VisualizationNode | null;
    x: number;
    y: number;
    edges: VisualizationEdge[];
    allNodes: VisualizationNode[];
  }

  let { node, x, y, edges, allNodes }: Props = $props();

  const connected = $derived(
    node
      ? edges
          .filter(e => e.source === node.id || e.target === node.id)
          .map(e => {
            const otherId = e.source === node.id ? e.target : e.source;
            return { node: allNodes.find(n => n.id === otherId), edgeLabel: e.label };
          })
          .filter(c => c.node)
      : []
  );

  const roleLabel: Record<string, string> = {
    central: 'Central',
    supporting: 'Supporting',
    contextual: 'Context',
    outcome: 'Outcome',
  };
</script>

{#if node}
  <div
    class="absolute z-30 pointer-events-none"
    style="left: {x}px; top: {y}px; transform: translate(-50%, -100%) translateY(-14px); max-width: 260px;"
  >
    <div
      class="rounded-xl px-3 py-2.5 text-sm"
      style="
        background: var(--glass-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      "
    >
      <div class="font-semibold mb-1 truncate" style="color: var(--text-primary)">{node.label}</div>

      {#if node.narrativeRole}
        <span
          class="text-xs px-1.5 py-0.5 rounded-full inline-block mb-2"
          style="background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); font-size: 10px"
        >{roleLabel[node.narrativeRole] ?? node.narrativeRole}</span>
      {/if}

      {#if node.details}
        <p class="text-xs leading-relaxed mb-2" style="color: var(--text-secondary); font-size: 11px">{node.details}</p>
      {/if}

      {#if connected.length > 0}
        <div style="border-top: 1px solid var(--border); padding-top: 6px; margin-top: 2px">
          {#each connected.slice(0, 5) as c}
            <div class="text-xs flex gap-1 leading-snug" style="color: var(--text-muted); font-size: 10px">
              <span style="color: var(--text-tertiary)">→</span>
              <span>{c.node?.label}</span>
              {#if c.edgeLabel}
                <span style="color: var(--text-tertiary)">({c.edgeLabel})</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

**Step 2: Run full test suite (no new tests needed — visual component)**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions).

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/NodeTooltip.svelte
git commit -m "feat: add NodeTooltip floating glass card for node hover"
```

---

## Task 9: Wire tooltip into VisualizerCanvas

**Files:**
- Modify: `src/lib/components/visualizer/VisualizerCanvas.svelte`

After each render, attach `mouseover`/`mouseout` event listeners to node elements. Track hovered node + cursor position in Svelte state. Render `NodeTooltip` as an overlay.

**Step 1: Update VisualizerCanvas.svelte**

Replace the entire file:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { renderVisualization } from './renderers';
  import NodeTooltip from './NodeTooltip.svelte';
  import type { VisualizationSchema, VisualizationNode } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    error: string | null;
    loading: boolean;
    panTick?: number;
    panDx?: number;
    panDy?: number;
    zoomTick?: number;
    zoomDelta?: number;
    onNodeClick?: (nodeId: string) => void;
  }

  let { visualization, error, loading, panTick = 0, panDx = 0, panDy = 0, zoomTick = 0, zoomDelta = 1.2, onNodeClick }: Props = $props();

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;

  let hoveredNode = $state<VisualizationNode | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  const PAN_STEP = 50;

  function render() {
    if (!svgEl || !visualization) return;
    const rect = containerEl.getBoundingClientRect();
    svgEl.setAttribute('width', String(rect.width));
    svgEl.setAttribute('height', String(rect.height));
    renderVisualization(svgEl, visualization);
    attachNodeEvents();
  }

  function attachNodeEvents() {
    if (!visualization) return;
    const containerRect = containerEl.getBoundingClientRect();

    // Both circle nodes (graph/tree/hierarchy) and g.node groups (flowchart)
    const nodeElements = svgEl.querySelectorAll('circle:not(.glow), g.node rect');

    nodeElements.forEach((el) => {
      const dataEl = el.closest('g.node') || el;

      el.addEventListener('mouseover', (e) => {
        const raw = (dataEl as any).__data__;
        // D3 hierarchy nodes wrap data; force nodes have fields directly
        const nodeData = raw?.data ?? raw;
        if (!nodeData?.id) return;
        const node = visualization!.nodes.find(n => n.id === nodeData.id);
        if (!node) return;
        const me = e as MouseEvent;
        tooltipX = me.clientX - containerRect.left;
        tooltipY = me.clientY - containerRect.top;
        hoveredNode = node;
      });

      el.addEventListener('mousemove', (e) => {
        if (!hoveredNode) return;
        const me = e as MouseEvent;
        tooltipX = me.clientX - containerRect.left;
        tooltipY = me.clientY - containerRect.top;
      });

      el.addEventListener('mouseout', () => {
        hoveredNode = null;
      });

      if (onNodeClick) {
        el.setAttribute('style', (el.getAttribute('style') || '') + ';cursor:pointer');
        el.addEventListener('click', (e) => {
          const raw = (dataEl as any).__data__;
          const nodeData = raw?.data ?? raw;
          if (nodeData?.id) onNodeClick(nodeData.id);
        });
      }
    });
  }

  function panBy(dx: number, dy: number) {
    if (!svgEl) return;
    const zoom = (svgEl as any).__d3Zoom;
    if (zoom) zoom.translateBy(d3.select(svgEl), dx, dy);
  }

  function zoomBy(factor: number) {
    if (!svgEl) return;
    const zoom = (svgEl as any).__d3Zoom;
    if (zoom) zoom.scaleBy(d3.select(svgEl), factor);
  }

  let lastPanTick = 0;
  $effect(() => {
    if (panTick > lastPanTick) {
      panBy(panDx * PAN_STEP, panDy * PAN_STEP);
      lastPanTick = panTick;
    }
  });

  let lastZoomTick = 0;
  $effect(() => {
    if (zoomTick > lastZoomTick) {
      zoomBy(zoomDelta);
      lastZoomTick = zoomTick;
    }
  });

  $effect(() => {
    if (visualization) render();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => {
      if (visualization) render();
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div bind:this={containerEl} class="w-full h-full relative">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center z-10" style="background: color-mix(in srgb, var(--canvas-bg) 70%, transparent)">
      <div class="flex items-center gap-2" style="color: var(--text-tertiary)">
        <div class="w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--border); border-top-color: var(--accent)"></div>
        <span class="text-sm">Generating visualization...</span>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center max-w-md">
        <p class="text-red-500 text-sm font-medium">Visualization Error</p>
        <p class="text-xs mt-1" style="color: var(--text-tertiary)">{error}</p>
      </div>
    </div>
  {/if}

  {#if !visualization && !loading && !error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center" style="color: var(--text-muted)">
        <p class="text-lg font-light">Concept Visualizer</p>
        <p class="text-sm mt-1">Write a concept in the editor and click Visualize</p>
      </div>
    </div>
  {/if}

  <svg bind:this={svgEl} class="w-full h-full"></svg>

  <NodeTooltip
    node={hoveredNode}
    x={tooltipX}
    y={tooltipY}
    edges={visualization?.edges ?? []}
    allNodes={visualization?.nodes ?? []}
  />
</div>
```

**Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 3: Commit**

```bash
git add src/lib/components/visualizer/VisualizerCanvas.svelte
git commit -m "feat: wire NodeTooltip hover overlay into VisualizerCanvas"
```

---

## Task 10: Add `--text-tertiary` CSS variable if missing

**Files:**
- Modify: `src/app.css`

The tooltip uses `--text-tertiary`. Check if it's already defined. If not, add it.

**Step 1: Check app.css for the variable**

```bash
grep -n "text-tertiary" src/app.css
```

If found: skip to Task 11.

If not found, open `src/app.css` and add `--text-tertiary` to both the light and dark theme blocks alongside the existing `--text-muted` variable:

```css
/* In the light theme block */
--text-tertiary: #9ca3af;

/* In the dark theme block */
--text-tertiary: #6b7280;
```

**Step 2: Run check**

```bash
npm run check
```

**Step 3: Commit (only if you made changes)**

```bash
git add src/app.css
git commit -m "fix: add --text-tertiary CSS variable for tooltip text"
```

---

## Task 11: Controls remap — remove right HUD cluster

**Files:**
- Modify: `src/lib/components/controls/GamepadControls.svelte`

The `ActionCluster` (Visualize / cycle type / export / auto-send) lives in the canvas bottom-right HUD. It conflicts with the tooltip overlay area. The `TextEditor` already has its own Visualize and auto-send controls, and keyboard shortcuts continue to work. Remove the right HUD cluster entirely from GamepadControls.

**Step 1: Edit GamepadControls.svelte**

In the `{#if placement === 'hud'}` block, delete the entire second `<div>` (the right cluster). It starts with:

```svelte
  <div
    class="absolute bottom-6 right-6 z-20 ...
```

...and ends just before `{:else if placement === 'dock'}`.

Also remove the `ActionCluster` and `PlacementToggle` imports from the `<script>` block, and remove their Props from the `interface Props` if they become unused.

After the edit, the `hud` block should only render the left nav/zoom cluster:

```svelte
{#if placement === 'hud'}
  <div
    class="absolute bottom-6 left-6 z-20 flex flex-col gap-4 items-center transition-opacity duration-300 rounded-2xl p-3"
    style="
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      opacity: {idle ? 0.4 : 1};
    "
    onmouseenter={() => { showKeyHints = true; resetIdle(); }}
    onmouseleave={() => showKeyHints = false}
    role="toolbar"
    tabindex="0"
    aria-label="Navigation controls"
  >
    <NavCluster {activeActions} {onAction} {showKeyHints} />
    <ZoomPair {activeActions} {onAction} {showKeyHints} />
  </div>
```

For the `dock` and `embedded` placement blocks: also remove `ActionCluster` and `PlacementToggle` from those renderings. Those placements become nav+zoom only.

**Step 2: Verify type-check passes**

```bash
npm run check
```

Expected: no errors. (If `vizType`, `autoSendOn`, `onPlacementChange` props become unused in GamepadControls, remove them from the Props interface and check that callers in `+page.svelte` still compile.)

**Step 3: Check the main page wiring**

Open `src/routes/+page.svelte`. If it passes `vizType`, `autoSendOn`, or `onPlacementChange` to `<GamepadControls>`, remove those props since GamepadControls no longer uses them.

Run again:

```bash
npm run check
```

**Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/lib/components/controls/GamepadControls.svelte src/routes/+page.svelte
git commit -m "feat: remove right HUD cluster from canvas, consolidate to nav+zoom only"
```

---

## Final Verification

**Run the dev server and manually verify:**

```bash
npm run dev
```

Check:
1. Open a concept file and click Visualize (keyboard shortcut Enter still works)
2. Graph: nodes have different sizes, soft editorial colors, curved edges
3. Graph: hover a node → tooltip appears with label, role badge, details, connections
4. Graph: click a node → non-neighbors fade; click background → restores
5. Central nodes have a faint outer glow ring
6. High-weight nodes (≥ 0.65) show a detail snippet below their label
7. Tree: bubble sizes vary, theme colors applied
8. Flowchart: pill-shaped nodes
9. Hierarchy: radial layout (concentric rings)
10. Right-side HUD cluster is gone; left nav/zoom cluster remains

**Final type-check:**

```bash
npm run check && npx vitest run
```

Expected: all clean.

**Final commit:**

```bash
git add -A
git commit -m "feat: rich storytelling visualizations — IIB-inspired visual encoding, tooltips, controls remap"
```
