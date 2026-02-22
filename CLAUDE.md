# Concept Visualizer — Project Context

## Architecture

SvelteKit 2 SPA (adapter-static, SSR disabled) with Svelte 5 runes ($props, $state, $derived, $effect). Client-direct LLM calls (no server proxy — browser fetches OpenAI-compatible endpoint directly). Primary experience is the 3D PlayCanvas visualizer at `/`. The 2D D3.js visualizer is deprecated at `/2d`.

## Key Patterns

- **Stores**: Svelte writable stores in `src/lib/stores/` — filesStore, vizStore, settingsStore, focusStore, files3dStore
- **Database**: Dexie.js wrapping IndexedDB in `src/lib/db/index.ts`. Tables: files, settings, files3d
- **Extractors**: `src/lib/extractors/` — ConceptExtractor interface, four engines behind a registry. All produce VisualizationSchema
- **3D Entity DSL**: PlayCanvas-aligned component-bag structure. Entities have `components: { render, light, ... }` matching PlayCanvas API. Typed subset of common properties + `[key: string]: unknown` passthrough for advanced PlayCanvas properties. Design doc: `docs/plans/2026-02-22-dsl-redesign-design.md`
- **Prefab System**: Named entity templates resolved at layer-creation time. Observation mode renderers use prefabs to map abstract concepts to 3D entities. Prefabs are data (JSON registry), not runtime instantiation.
- **Observation Modes**: 3D renderers that take VisualizationSchema → Layer3d[]. Each mode has its own visual language (spatial metaphor, color palette, prefabs). Registered via ObservationModeRegistry.
- **Renderers (2D)**: `src/lib/components/visualizer/renderers/` — D3.js renderers for graph, tree, flowchart, hierarchy (deprecated `/2d` route)
- **Renderer utilities**: `src/lib/components/visualizer/renderers/utils.ts` — shared palette (`THEME_COLORS_LIGHT`/`THEME_COLORS_DARK`), `themeColor()`, `nodeRadius()`, `edgeThickness()`, `edgeOpacity()`, `hexToRgba()`, `truncate()`
- **Controls**: `src/lib/components/controls/` — Gamepad-inspired pad components (nav/zoom only on canvas), keyboard controller in `src/lib/controllers/keyboard.ts`

## Commands

```bash
npm run dev          # Dev server on port 5173
npm test             # vitest (uses fake-indexeddb)
npx vitest run       # Single test run
npm run build        # Production build (adapter-static)
npm run check        # svelte-check type checking
```

## Conventions

- Svelte 5 runes only — no legacy `$:` reactive statements, no `export let`
- Component props via `interface Props` + `$props()`
- Tailwind CSS 4 with `@tailwindcss/vite` plugin (not PostCSS)
- CSS custom properties for adaptive theming (`--accent`, `--glass-bg`, etc.) in `src/app.css`
- TDD: tests live next to source files (`*.test.ts`)
- No direct HTML string injection (innerHTML, document writing methods) — security hooks reject these. Always use DOM manipulation: createElement, appendChild, cloneNode

## File Layout

```
src/
  app.css              # Tailwind + CSS custom properties
  app.html             # Space Grotesk font link
  routes/
    +page.svelte       # 3D visualizer (homepage)
    +layout.svelte     # Global CSS + theme sync
    +layout.ts         # SPA mode (ssr=false)
    2d/+page.svelte    # 2D visualizer (deprecated)
    3d/+page.ts        # Redirect → /
    settings/+page.svelte
  lib/
    types.ts           # VisualizationSchema, ConceptFile, AppSettings
    db/index.ts        # Dexie database
    stores/            # Svelte stores (files, visualization, settings, focus)
    llm/               # LLM client, prompts, parser
    extractors/        # ConceptExtractor engines + registry
    controllers/       # Keyboard controller
    components/
      AppShell.svelte  # Three-slot layout (sidebar, main, editor)
      controls/        # Gamepad pad components
      editor/          # ConceptDetails, TextEditor, EditorPane
      visualizer/      # VisualizerCanvas + D3 renderers
      files/           # FileList, FileItem
      export/          # ExportMenu
    export/            # PDF, Markdown, SVG-to-PNG
docs/plans/            # Design docs and implementation plans
```

## Types

The central data contract is `VisualizationSchema` in `src/lib/types.ts`. All extractors produce it, all renderers consume it.

### VisualizationNode fields (all optional except id/label)
- `weight?: number` — 0–1 importance → node radius (12–40px via `nodeRadius()`)
- `theme?: string` — cluster label → color family via `themeColor()`
- `narrativeRole?: 'central' | 'supporting' | 'contextual' | 'outcome'` — visual emphasis
- `details?: string` — 1-2 sentence description shown in tooltip and as inline snippet for weight ≥ 0.65

### VisualizationEdge fields
- `strength?: number` — 0–1 relationship strength → line thickness + opacity

## Visualization Components

- `VisualizerCanvas.svelte` — SVG canvas with zoom/pan, post-render event attachment, NodeTooltip overlay
- `NodeTooltip.svelte` — floating glass card on hover: shows label, narrativeRole badge, details, connected nodes
- Hover any node → tooltip; click any node → neighbourhood highlight (others fade to 12%); click background → reset

## Controls Layout

- **Canvas** (left HUD): NavCluster + ZoomPair only — pan/zoom navigation
- **Editor pane**: Visualize, cycle type, export, auto-send — all editor actions live here
- **Keyboard shortcuts**: Enter=visualize, Tab=cycle type, P=export, Q=auto-send (unchanged)
- Right HUD cluster removed to free canvas for tooltip overlays

## 3D Pipeline

Chat-driven concept visualization: user types in floating CodeMirror input → extraction pipeline produces VisualizationSchema → observation mode renderer maps schema to Layer3d[] → compositor merges layers → PlayCanvas renders.

- **Two-stage**: shared extractor (VisualizationSchema) + mode-specific 3D renderer (Layer3d[])
- **Additive**: each chat message appends layers, doesn't replace
- **CRDT-ready**: fractional index ordering, UUID layer IDs, provenance tracking via LayerSource
- **Scene3d** replaces File3d: adds `environment`, `messages[]`, `version`, `layers[].source`

## Upcoming Work

- DSL redesign implementation (see `docs/plans/2026-02-22-dsl-redesign-design.md`)
- Observation mode renderers (graph, morality, epistemology, storyboard)
- Chat input UI (CodeMirror floating input)
- Pipeline integration into 3D homepage
- Prefab registry and starter prefabs

## Testing

Tests use vitest + jsdom + fake-indexeddb. Run `npx vitest run` for a single pass. Store tests call `.init()` in beforeEach to reset singleton state.
