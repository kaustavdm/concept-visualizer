# PWA Design — Concept Visualizer

**Date:** 2026-02-18

## Goal

Make the app installable and offline-first. The three local extractors (NLP, Keywords, Semantic) already work without a network; the app shell should too.

## Changes

| File | Action |
|------|--------|
| `src/routes/settings/+page.svelte` | Replace hardcoded `https://conceptviz.vercel.app` with `window.location.origin` |
| `vite.config.ts` | Add `vite-plugin-pwa` with Workbox config |
| `src/app.html` | Add `<title>`, theme-color meta |
| `static/favicon.svg` | SVG icon (graph-node motif) |
| `static/icon.svg` | Same icon padded for maskable use |

## Caching Strategy

- **App shell** (HTML/CSS/JS): precached from Workbox build manifest
- **Google Fonts stylesheet**: StaleWhileRevalidate
- **Google Fonts files**: CacheFirst, 1-year TTL
- **TF.js model** (~30 MB): CacheFirst, 30-day TTL, 1 entry
- **LLM endpoint**: not cached

## SW Update Behaviour

`registerType: 'autoUpdate'` — new versions install silently.

## Manifest

```json
{
  "name": "Concept Visualizer",
  "short_name": "ConceptViz",
  "display": "standalone",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```
