# Route Swap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the 3D visualizer the homepage (`/`), move the deprecated 2D visualizer to `/2d`, add a `/3d` redirect, strip 2D-only settings, and update all documentation.

**Architecture:** Pure file moves for routes (git mv), a SvelteKit redirect module for `/3d` → `/`, settings page slimmed to shared-only fields. No store/type changes — `AppSettings` retains all fields for backward compat with 2D route.

**Tech Stack:** SvelteKit 2 (Svelte 5), adapter-static

---

### Task 1: Move 2D page to /2d

**Files:**
- Move: `src/routes/+page.svelte` → `src/routes/2d/+page.svelte`

**Step 1: Create the 2d route directory**

```bash
mkdir -p src/routes/2d
```

**Step 2: Move the 2D homepage**

```bash
git mv src/routes/+page.svelte src/routes/2d/+page.svelte
```

**Step 3: Verify the file landed correctly**

```bash
ls src/routes/2d/+page.svelte
```

Expected: file exists.

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor(routes): move 2D visualizer to /2d"
```

---

### Task 2: Move 3D page to homepage

**Files:**
- Move: `src/routes/3d/+page.svelte` → `src/routes/+page.svelte`

**Step 1: Move the 3D page to root**

```bash
git mv src/routes/3d/+page.svelte src/routes/+page.svelte
```

**Step 2: Verify**

```bash
ls src/routes/+page.svelte
# Should exist and contain PlayCanvas imports (createScene, files3dStore, etc.)
head -5 src/routes/+page.svelte
```

Expected: first lines show `createScene`, `files3dStore` imports.

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor(routes): move 3D visualizer to homepage"
```

---

### Task 3: Add /3d redirect

**Files:**
- Create: `src/routes/3d/+page.ts`

**Step 1: Create redirect module**

Create `src/routes/3d/+page.ts` with:

```typescript
import { redirect } from '@sveltejs/kit';

export function load() {
  redirect(301, '/');
}
```

**Step 2: Verify the redirect**

Run the dev server (`npm run dev`) and navigate to `http://localhost:5173/3d`. It should redirect to `/`.

**Step 3: Commit**

```bash
git add src/routes/3d/+page.ts && git commit -m "feat(routes): add 301 redirect from /3d to /"
```

---

### Task 4: Update AppShell settings link

The `AppShell.svelte` sidebar links to `/settings`. This is fine — settings still lives at `/settings`. But the settings cancel link (`href="/"`) and save redirect (`goto('/')`) both point to `/` which will now be the 3D page. This is correct per the design (settings always redirects to homepage).

No code changes needed for AppShell. This task is a verification-only step.

**Step 1: Verify links are correct**

Check `src/lib/components/AppShell.svelte` line 28: `href="/settings"` — correct, no change needed.

Check `src/routes/settings/+page.svelte` line 34: `goto('/')` — correct, now goes to 3D homepage.

Check `src/routes/settings/+page.svelte` line 159: `href="/"` — correct, cancel goes to 3D homepage.

---

### Task 5: Strip 2D-only settings from settings page

**Files:**
- Modify: `src/routes/settings/+page.svelte`

**Step 1: Remove 2D-only state variables**

Remove these local state declarations (keep `endpoint`, `model`, `theme`):

```diff
- let controlPlacement = $state<'hud' | 'dock' | 'embedded'>('hud');
- let extractionEngine = $state<'llm' | 'nlp' | 'keywords' | 'semantic'>('llm');
- let pipelineMode = $state<'auto' | 'manual'>('auto');
- let llmRefinement = $state(false);
```

**Step 2: Remove 2D-only onMount reads**

In the `onMount` callback, remove:

```diff
- controlPlacement = $settingsStore.controlPlacement;
- extractionEngine = $settingsStore.extractionEngine;
- pipelineMode = $settingsStore.pipelineMode ?? 'auto';
- llmRefinement = $settingsStore.llmRefinement ?? false;
```

**Step 3: Remove 2D-only fields from save call**

Change the `save()` function to only pass shared fields:

```typescript
async function save() {
  await settingsStore.update({ llmEndpoint: endpoint, llmModel: model, theme });
  goto('/');
}
```

**Step 4: Remove 2D-only form controls from template**

Remove these template sections:
- Pipeline Mode `<select>` block (lines 91-103)
- LLM Refinement checkbox block (lines 105-118)
- Control Placement `<select>` block (lines 120-132)
- Extraction Engine `<select>` block (lines 134-148)

**Step 5: Remove the isMixedContent derived and pageOrigin**

These relate to LLM endpoint and should stay — they're shared. Keep them.

**Step 6: Build check**

```bash
npm run check
```

Expected: no type errors.

**Step 7: Commit**

```bash
git add src/routes/settings/+page.svelte && git commit -m "refactor(settings): remove 2D-only settings from UI"
```

---

### Task 6: Smoke test the full app

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Verify routes**

- `http://localhost:5173/` — should show 3D PlayCanvas scene
- `http://localhost:5173/2d` — should show 2D D3.js visualizer
- `http://localhost:5173/3d` — should redirect to `/`
- `http://localhost:5173/settings` — should show settings with only LLM endpoint, model, and theme

**Step 3: Run existing tests**

```bash
npx vitest run
```

Expected: all tests pass (no route-dependent tests exist).

**Step 4: Run type check**

```bash
npm run check
```

Expected: no errors.

---

### Task 7: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README**

Replace README with updated content that:
- Keeps the same project mission (concept visualization from text)
- Describes 3D (PlayCanvas) as the primary visualization at `/`
- Marks 2D (D3.js) as deprecated, available at `/2d` until 3D reaches stability
- Updates tech stack to include PlayCanvas
- Updates keyboard controls to match 3D (from KeyboardHelp.svelte)
- Keeps extraction engines table (will be integrated into 3D)
- Keeps development commands section

New README content:

```markdown
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

\```bash
npm install
npm run dev
\```

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

\```bash
npm test          # Run vitest
npm run build     # Production build
npm run check     # Type check
\```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md && git commit -m "docs: update README for 3D-first experience"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Key changes:
- Update architecture description to mention 3D as primary
- Update file layout to show new route structure (`/` = 3D, `/2d` = deprecated 2D, `/3d` = redirect)
- Keep all 2D architecture docs as reference (extractors, renderers, etc.) since we'll reuse components
- Add note about upcoming extraction pipeline integration into 3D
- Update controls layout section for 3D controls

**Step 2: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: update CLAUDE.md for 3D-primary route structure"
```

---

### Task 9: Update memory files

**Files:**
- Modify: `MEMORY.md` (auto-memory)

**Step 1: Update MEMORY.md**

- Change `## 3D Visualizer (src/routes/3d/)` header to `## 3D Visualizer (src/routes/ — homepage)`
- Add a section noting the route swap: 3D is now `/`, 2D deprecated at `/2d`, `/3d` redirects to `/`

**Step 2: No commit needed** (memory files are outside repo)
