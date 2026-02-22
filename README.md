# Concept Visualizer

Turn written text into rich, story-driven concept visualizations using local LLMs or offline extraction engines.

## Features

- **3D concept visualization**: Immersive PlayCanvas-powered scene with orbit, fly, and follow camera modes
- **Layer-based composition**: Build scenes from composable layers with per-entity animations
- **Scene management**: Create, clone, rename, and switch between concept scenes — persisted in IndexedDB via Dexie.js
- **Hex dial controls**: Gamepad-inspired hexagonal dials for scene actions, camera modes, and theme switching
- **Vim-like input mode**: Command mode for shortcuts, input mode for text fields — status bar shows active mode
- **Adaptive theming**: System/light/dark theme cycling with glass-morphism UI
- **Voice input**: Web Speech API for hands-free text entry
- **Four extraction engines**: LLM (OpenAI-compatible), NLP (compromise.js), Keywords (RAKE), Semantic (TF.js + USE)

> **Note:** The 2D D3.js visualizer is deprecated and available at `/2d` while the 3D experience reaches feature parity.

## Tech Stack

SvelteKit 2 (Svelte 5) | TypeScript | Tailwind CSS 4 | PlayCanvas | D3.js | Dexie.js | Space Grotesk

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` for the 3D visualizer. The deprecated 2D visualizer is at `http://localhost:5173/2d`.

### Keyboard Controls (3D)

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| W/A/S/D | Pan camera | ? | Toggle keyboard help |
| Z/X | Zoom in/out | F | Toggle fullscreen |
| C | Look at origin | H | Toggle controls |
| Shift (hold) | Toggle orbit/fly | I | Enter input mode |
| Space | Cycle follow target | Esc | Close / exit input mode |
| O/;/./,/M/K | Hex dial faces | L | Switch hex dial bay |
| 1-9 | Select fan-out option | | |

### Extraction Engines

| Engine | Requires | Speed | Quality |
|--------|----------|-------|---------|
| LLM | Running OpenAI-compatible server | 2-10s | Best |
| NLP | Nothing (offline) | <100ms | Good for structured English |
| Keywords | Nothing (offline) | <10ms | Basic co-occurrence |
| Semantic | ~30MB model download (cached) | 2-5s | Good semantic understanding |

Configure the LLM endpoint and model in **Settings**.

## Development

```bash
npm test          # Run vitest
npm run build     # Production build
npm run check     # Type check
```

## License

MIT
