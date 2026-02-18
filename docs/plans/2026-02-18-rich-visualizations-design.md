# Rich Storytelling Visualizations — Design

**Date**: 2026-02-18
**Status**: Approved

## Problem

The current visualizers render only labels on uniform circles/rectangles. The `details` field extracted by the LLM is silently discarded. Nodes are identically sized and colored, edges are straight lines of equal weight, and there is no interactivity beyond pan/zoom. The result feels like a schematic rather than a story.

## Goals

- Visualizations that encode semantic richness: importance, cluster affinity, narrative role, relationship strength
- Visual language inspired by InformationIsBeautiful (David McCandless): soft editorial palette, variable node sizes, brief inline descriptions, curved edges
- Interactive reveal: hover tooltips and neighborhood-highlight on click
- Controls remap: free the canvas of editor-specific actions

---

## 1. Schema Expansion

### New fields on `VisualizationNode`

```ts
weight?: number;          // 0–1 importance/centrality → node radius
theme?: string;           // cluster name (e.g. "process", "outcome") → color family
narrativeRole?: 'central' | 'supporting' | 'contextual' | 'outcome';
```

The existing `details?: string` field will now be rendered visually. The existing `group` field is preserved for backward compatibility.

### New field on `VisualizationEdge`

```ts
strength?: number;        // 0–1 relationship strength → line thickness + opacity
```

The existing `type` field vocabulary is expanded to include `'contrasts'` and `'transforms'`.

All new fields are optional. Existing data continues to render correctly.

---

## 2. LLM Prompt Update

The system prompt is expanded to:

- Request `weight` per node (0.0–1.0, reflecting how central the concept is to the text)
- Request `theme` per node (a short thematic cluster label, e.g. "agent", "process", "outcome", "emotion")
- Request `narrativeRole` per node (`central` for the main subject, `supporting` for key actors, `contextual` for background, `outcome` for results/conclusions)
- Request `strength` per edge (0.0–1.0, reflecting how explicit and strong the relationship is in the source text)
- Require richer `details` text: 1–2 sentences describing the concept's role in context (not just a definition)
- Keep node count: 5–15

---

## 3. Visual Language

### Color Palette (IIB-inspired, soft editorial)

Seven theme-keyed hues, assigned by hashing the theme string or index:

| Slot | Fill | Use |
|------|------|-----|
| 0 | `#7b9bcd` | Slate Blue (default) |
| 1 | `#7bae9d` | Sage Green |
| 2 | `#e07b7b` | Coral Rose |
| 3 | `#d4a85a` | Warm Amber |
| 4 | `#a07bcd` | Lavender |
| 5 | `#5aacbc` | Teal |
| 6 | `#c4a97d` | Sand |

Fills are rendered at 80% opacity. Strokes are the same hue darkened by 20%.

### Node Sizing

```
radius = 12 + (node.weight ?? 0.5) * 28   // range: 12px–40px
```

### Node Visual Hierarchy

- **`central`** nodes: outer concentric glow ring at radius+8, same fill color at 25% opacity
- **`supporting`** nodes: standard fill
- **`contextual`** nodes: fill at 55% opacity, smaller label
- **`outcome`** nodes: slight stroke dash pattern

### In-node Labels and Descriptions

- Label rendered **bold, centered** inside the circle when radius ≥ 22px
- For nodes with `weight ≥ 0.6`: a 2-line detail snippet (max ~45 chars) shown below the label in 9px text — visible without hover, IIB-style

### Edge Rendering

- **Curved paths**: quadratic bezier curves (control point offset 30px perpendicular from midpoint) — no straight lines
- **Thickness**: `1 + (edge.strength ?? 0.5) * 3` → range 1–4px
- **Opacity**: `0.4 + (edge.strength ?? 0.5) * 0.5` → range 0.4–0.9
- **Labels**: only for edges with `strength > 0.5`, rendered at midpoint in 9px text
- **`contrasts`** edge type: dashed stroke

### Flowchart Nodes

- Pill-shaped: `border-radius = node_height / 2` — not sharp rectangles
- Theme-colored fills (same palette)
- Small detail text below label for central nodes

### Hierarchy Renderer (Radial Dendrogram)

- Redesigned from horizontal tree to **radial layout** (concentric rings, inspired by "Being Defensive")
- Root at center, children radiate outward
- Color arcs per depth level using the theme palette

---

## 4. Interactivity

### Hover Tooltip

- Trigger: `mouseover` on any node, 200ms delay
- Shows: full `details` text, `narrativeRole` badge, list of connected node labels with edge labels
- Dismissed on `mouseout`
- Implemented as a `NodeTooltip.svelte` overlay component positioned by `VisualizerCanvas`
- Styled as a glass card (`--glass-bg`, `backdrop-filter: blur`)

### Neighborhood Highlight

- Trigger: click on a node
- Effect: all nodes and edges NOT connected to the clicked node fade to 15% opacity (300ms ease transition)
- The clicked node and its direct neighbors + connecting edges remain at full opacity
- Dismissed by: clicking the same node again, or clicking the SVG background
- State held in D3 selection data — no external store needed

---

## 5. Controls Remap

### Problem

The right-side HUD cluster (`ActionCluster` + `PlacementToggle`) occupies the canvas bottom-right corner — exactly where interactive tooltip/detail overlays need space.

### Solution

| Control | Current location | New location |
|---------|-----------------|--------------|
| NavCluster + ZoomPair | Canvas bottom-left HUD | Unchanged |
| ActionCluster (Visualize, cycle type, export, auto-send) | Canvas bottom-right HUD | Editor pane — compact horizontal toolbar below the title bar |
| PlacementToggle | Canvas bottom-right HUD | Removed |

The `GamepadControls` component is simplified: the `hud` rendering path only renders the left cluster. The right cluster is removed.

The `EditorPane` gains a compact action toolbar between the title bar and `ConceptDetails`:

```
[ Visualize ]  [ ⇄ Graph ]  [ ↓ Export ]  [ ⟳ Auto ]
```

Keyboard bindings are unchanged (Enter=visualize, Tab=cycle, P=export, Q=auto-send).

---

## File Changelist

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `weight`, `theme`, `narrativeRole` to `VisualizationNode`; add `strength` to `VisualizationEdge` |
| `src/lib/llm/prompts.ts` | Expand system prompt to request new fields |
| `src/lib/components/visualizer/renderers/graph.ts` | Curved edges, variable node sizes, glow rings, detail snippets, hover/click interactivity |
| `src/lib/components/visualizer/renderers/tree.ts` | Variable bubble sizes, curved links, theme colors |
| `src/lib/components/visualizer/renderers/flowchart.ts` | Pill nodes, theme fills, edge strength |
| `src/lib/components/visualizer/renderers/hierarchy.ts` | Radial dendrogram layout |
| `src/lib/components/visualizer/NodeTooltip.svelte` | New: floating glass tooltip card |
| `src/lib/components/visualizer/VisualizerCanvas.svelte` | Wire tooltip position, forward node click events |
| `src/lib/components/controls/GamepadControls.svelte` | Remove right HUD cluster |
| `src/lib/components/editor/EditorPane.svelte` | Add compact action toolbar |
