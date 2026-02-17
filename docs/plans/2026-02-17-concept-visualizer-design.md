# Concept Visualizer — Design Document

**Date:** 2026-02-17

## Purpose

A web application that visualizes concepts from written text using local LLMs. Users write or paste explanatory text, and the app generates context-dependent visualizations (graphs, trees, flowcharts, hierarchies) powered by a configurable OpenAI-compatible LLM endpoint.

## Architecture

### Deployment Model

- **SvelteKit web app** running in SPA mode
- Designed to run locally (`npm run dev` / `npm run preview`) for local LLM access
- Deployable to Vercel for use with remote OpenAI-compatible APIs
- Tauri desktop wrapper deferred to a future milestone

### LLM Communication

- **Client-direct**: the browser calls the LLM endpoint via `fetch` — no server-side proxy
- Configurable endpoint URL stored in `localStorage` / IndexedDB
- Uses OpenAI chat completions format (`/v1/chat/completions`)
- Supports streaming for progressive rendering
- LLM trigger: explicit button/shortcut by default, with toggle for debounced auto-send

### Why Client-Direct

Server-side proxy (SvelteKit `+server.ts` routes) was considered but rejected because:
- Serverless deployments (Vercel) cannot reach `localhost` LLM endpoints
- Local LLMs don't need API key protection
- Client-direct works in both local and hosted scenarios

## UI Layout

Two-pane layout:

- **Main pane (left, larger)**: D3.js visualization canvas — renders the concept visualization
- **Editor pane (right, smaller)**: contains concept details/relationships at the top, text editor below, and a "Visualize" button/auto-send toggle

## Data Model

### Visualization Schema

The LLM returns structured JSON conforming to this schema:

```typescript
type VisualizationType = 'graph' | 'tree' | 'flowchart' | 'hierarchy';

interface VisualizationSchema {
  type: VisualizationType;
  title: string;
  description: string;
  nodes: Array<{
    id: string;
    label: string;
    type?: string;       // e.g. "concept", "process", "decision"
    group?: string;       // for clustering/coloring
    details?: string;     // tooltip or expanded info
  }>;
  edges: Array<{
    source: string;       // node id
    target: string;       // node id
    label?: string;       // relationship label
    type?: string;        // e.g. "causes", "contains", "precedes"
  }>;
  metadata: {
    concepts: string[];   // extracted key concepts
    relationships: string[]; // human-readable relationship summaries
  };
}
```

### Concept Files

Each visualization session is a "file" persisted in IndexedDB:

```typescript
interface ConceptFile {
  id: string;            // UUID
  title: string;
  createdAt: Date;
  updatedAt: Date;
  text: string;          // editor content
  visualization: VisualizationSchema | null;
  settings: {
    autoSend: boolean;
    vizType?: VisualizationType; // user override, or null for auto
  };
}
```

### App Settings

```typescript
interface AppSettings {
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
}
```

## Persistence

- **Dexie.js** (IndexedDB wrapper) for all client-side storage
- Files auto-save on edit (debounced)
- Last-opened file restored on app launch
- File list sorted by `updatedAt` (most recent first)
- CRUD operations: create, rename, delete files

## Export

### PDF Export

- Render D3 visualization to SVG, convert to high-quality image
- Print-optimized layout template: title, visualization graphic, concept details, explanatory text
- Generated via browser `window.print()` with `@media print` stylesheet — no server dependency

### Markdown + Images Export

- Export D3 SVG as `.png` image
- Generate Markdown document with embedded image reference, concepts list, and explanation text
- Downloaded as `.zip` containing `.md` file and image(s)

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Framework | SvelteKit (SPA mode) | Routing, layout, build tooling |
| Visualization | D3.js | Render graphs, trees, flowcharts |
| LLM Client | Browser fetch | Call OpenAI-compatible endpoints directly |
| Storage | Dexie.js (IndexedDB) | Persist files, settings, sessions |
| PDF Export | `@media print` + browser print | Client-side PDF generation |
| MD Export | SVG-to-PNG + generated markdown | Downloadable `.zip` |
| Styling | Tailwind CSS | Utility-first, responsive layout |
| State | Svelte stores | Reactive state for viz data, files, config |

## Project Structure

```
src/
  lib/
    components/
      editor/          — Text editor pane, concept details display
      visualizer/      — D3 canvas, type-specific renderers
      files/           — File list, file management UI
      settings/        — LLM endpoint config, preferences
      export/          — PDF and Markdown export UI
    stores/
      files.ts         — File CRUD, active file state
      visualization.ts — Current viz schema, loading state
      settings.ts      — App settings (endpoint, model, theme)
    llm/
      client.ts        — LLM API wrapper
      prompts.ts       — System prompts, schema instructions
      parser.ts        — Response validation and parsing
    db/
      index.ts         — Dexie database setup
      migrations.ts    — Schema migrations
    export/
      pdf.ts           — Print-to-PDF logic
      markdown.ts      — MD + image generation
  routes/
    +layout.svelte     — Two-pane layout shell
    +page.svelte       — Main app page
    settings/
      +page.svelte     — Settings page
```

## Deferred Features

- Voice input / spoken dictation (Web Speech API or local Whisper)
- Tauri desktop wrapper for native distribution
- Collaboration / sharing
