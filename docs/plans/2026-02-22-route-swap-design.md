# Route Swap: 3D as Homepage

**Date:** 2026-02-22

## Goal

Make the 3D visualizer the homepage (`/`). Move the 2D visualizer to `/2d` as a deprecated route. Redirect `/3d` → `/` for bookmarked URLs. Strip 2D-only settings from the settings page. Update all documentation.

The project mission is unchanged: turn written text into concept visualizations. The 3D engine is the new primary visualization medium. The 2D version is deprecated but remains available until 3D reaches feature parity.

## Route Changes

**File moves (git mv):**

| From | To |
|------|----|
| `src/routes/+page.svelte` | `src/routes/2d/+page.svelte` |
| `src/routes/3d/+page.svelte` | `src/routes/+page.svelte` |

**New file:**

- `src/routes/3d/+page.ts` — SvelteKit `redirect(301, '/')` so bookmarked `/3d` URLs work.

**Resulting routes:**

| Route | Content |
|-------|---------|
| `/` | 3D visualizer (primary) |
| `/2d` | 2D visualizer (deprecated) |
| `/3d` | 301 redirect → `/` |
| `/settings` | Settings page |

No UI links between `/` and `/2d`. The 2D route is hidden — accessible only by direct URL.

## Settings Page Cleanup

**Remove from UI** (2D-only, no longer relevant to primary experience):

- `controlPlacement` (hud / dock / embedded)
- `extractionEngine` (llm / nlp / keywords / semantic)
- `pipelineMode` (auto / manual)
- `llmRefinement` checkbox

**Keep:**

- LLM Endpoint + Model (shared infrastructure, 3D will use LLM)
- Theme (shared)

**Note:** `AppSettings` type and `DEFAULT_SETTINGS` in `types.ts` retain all fields for backward compatibility with the 2D route. Only the settings page UI changes.

## Documentation Updates

### README.md

- Same project description and mission — concept visualization from text
- Note 3D (PlayCanvas) is now the primary visualization, 2D (D3.js) is deprecated at `/2d`
- Update tech stack to include PlayCanvas
- Update keyboard controls to reflect 3D controls
- Keep extraction engines table — that pipeline will be integrated into 3D
- Mark 2D as deprecated, available until 3D reaches stability

### CLAUDE.md

- Update file layout and route descriptions
- Note 3D as primary, 2D as deprecated
- Keep 2D architecture docs as reference for future component reuse
- Note upcoming work: extraction pipeline integration into 3D

### Memory files

- Update `MEMORY.md` with new route structure
- Note 2D deprecation and future integration plans

## Out of Scope

- Changing shared stores (`settingsStore`, Dexie database)
- Modifying `AppSettings` type or `DEFAULT_SETTINGS`
- Adding navigation links between 2D and 3D
- Extraction pipeline integration into 3D (future work)
