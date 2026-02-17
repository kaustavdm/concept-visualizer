# Concept Visualizer — Project Context

## Architecture

SvelteKit 2 SPA (adapter-static, SSR disabled) with Svelte 5 runes ($props, $state, $derived, $effect). Client-direct LLM calls (no server proxy — browser fetches OpenAI-compatible endpoint directly).

## Key Patterns

- **Stores**: Svelte writable stores in `src/lib/stores/` — filesStore, vizStore, settingsStore, focusStore
- **Database**: Dexie.js wrapping IndexedDB in `src/lib/db/index.ts`. Tables: files, settings
- **Extractors**: `src/lib/extractors/` — ConceptExtractor interface, four engines behind a registry. All produce VisualizationSchema
- **Renderers**: `src/lib/components/visualizer/renderers/` — D3.js renderers for graph, tree, flowchart, hierarchy
- **Controls**: `src/lib/components/controls/` — Gamepad-inspired pad components, keyboard controller in `src/lib/controllers/keyboard.ts`

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
    +page.svelte       # Main app wiring
    +layout.svelte     # Global CSS
    +layout.ts         # SPA mode (ssr=false)
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

## Testing

Tests use vitest + jsdom + fake-indexeddb. Run `npx vitest run` for a single pass. Store tests call `.init()` in beforeEach to reset singleton state.
