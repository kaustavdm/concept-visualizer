# Concept Visualizer

Turn written text into rich, story-driven concept visualizations using local LLMs or offline extraction engines.

## Features

- **Four visualization types**: Graph, Tree, Flowchart, Hierarchy — each tells a different story about the same concepts
- **Storytelling visual encoding**: Node size = importance (weight), color family = theme cluster, glow rings for central/outcome nodes, curved bezier edges with strength thickness
- **Hover tooltip**: Glass card shows concept description, narrative role badge, and up to 5 connected nodes on hover
- **Neighbourhood highlight**: Click any node to dim all non-neighbours to 12% opacity; click background to restore
- **Four extraction engines**: LLM (OpenAI-compatible), NLP (compromise.js), Keywords (RAKE), Semantic (TF.js + Universal Sentence Encoder)
- **Gamepad-inspired controls**: WASD navigation, Z/X zoom, Enter to visualize, Tab to cycle viz types — every key lights up its on-screen button
- **Adaptive theming**: Accent colors shift with visualization type (blue/emerald/amber/violet), dark mode support
- **File management**: Create, rename, delete concept files — persisted in IndexedDB via Dexie.js
- **Export**: PDF and Markdown+images (PNG) export

## Tech Stack

SvelteKit 2 (Svelte 5) | TypeScript | Tailwind CSS 4 | D3.js | Dexie.js | Space Grotesk

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Write or paste text in the editor pane, press Enter (or click Visualize) to generate a visualization.

### Extraction Engines

| Engine | Requires | Speed | Quality |
|--------|----------|-------|---------|
| LLM | Running OpenAI-compatible server | 2-10s | Best |
| NLP | Nothing (offline) | <100ms | Good for structured English |
| Keywords | Nothing (offline) | <10ms | Basic co-occurrence |
| Semantic | ~30MB model download (cached) | 2-5s | Good semantic understanding |

Configure the engine and LLM endpoint in **Settings** (sidebar bottom). Fast-switch with **Shift+Tab**.

### Keyboard Controls

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| W/A/S/D | Navigate nodes | Enter | Visualize |
| Z/X | Zoom in/out | Tab | Cycle viz type |
| Space | Fit to screen | P | Export menu |
| Arrows | Pan canvas | Q | Toggle auto-send |
| Esc | Deselect | Shift+Tab | Cycle engine |

## Development

```bash
npm test          # Run vitest
npm run build     # Production build
npm run check     # Type check
```

## License

MIT
