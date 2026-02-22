# Concept Visualizer — Project Context

## Architecture

SvelteKit 2 SPA (adapter-static, SSR disabled) with Svelte 5 runes ($props, $state, $derived, $effect). Client-direct LLM calls (no server proxy — browser fetches OpenAI-compatible endpoint directly). Primary experience is the 3D PlayCanvas visualizer at `/`.

## Key Patterns

- **Stores**: Svelte writable stores in `src/lib/stores/` — settingsStore, files3dStore
- **Database**: Dexie.js wrapping IndexedDB in `src/lib/db/index.ts`. Tables: settings, files3d
- **Extractors**: `src/lib/extractors/` — ConceptExtractor interface, four engines behind a registry. All produce VisualizationSchema
- **3D Entity DSL**: PlayCanvas-aligned component-bag structure. Entities have `components: { render, light, ... }` matching PlayCanvas API. Typed subset of common properties + `[key: string]: unknown` passthrough for advanced PlayCanvas properties. Design doc: `docs/plans/2026-02-22-dsl-redesign-design.md`
- **Prefab System**: Named entity templates resolved at layer-creation time. Observation mode renderers use prefabs to map abstract concepts to 3D entities. Prefabs are data (JSON registry), not runtime instantiation.
- **Observation Modes**: 3D renderers that take VisualizationSchema → Layer3d[]. Each mode has its own visual language (spatial metaphor, color palette, prefabs). Registered via ObservationModeRegistry.

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
    3d/+page.ts        # Redirect → /
    settings/+page.svelte
  lib/
    types.ts           # VisualizationSchema, AppSettings
    db/index.ts        # Dexie database
    stores/            # Svelte stores (settings, files3d)
    llm/               # LLM client, prompts, parser
    extractors/        # ConceptExtractor engines + registry
    pipeline/          # Extraction pipeline orchestrator
    3d/                # Entity DSL, compositor, animation, observation modes, prefabs
    components/
      AppShell.svelte  # Three-slot layout (sidebar, main, editor)
      3d/              # 3D-specific components (scene, controls, panels)
docs/plans/            # Design docs and implementation plans
```

## Types

The central data contract is `VisualizationSchema` in `src/lib/types.ts`. All extractors produce it, observation modes consume it.

### VisualizationNode fields (all optional except id/label)
- `weight?: number` — 0–1 importance
- `theme?: string` — cluster label → color family
- `narrativeRole?: 'central' | 'supporting' | 'contextual' | 'outcome'` — visual emphasis
- `details?: string` — 1-2 sentence description

### VisualizationEdge fields
- `strength?: number` — 0–1 relationship strength

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
