# Concept Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a SvelteKit web app that visualizes concepts from written text using local LLMs, with IndexedDB persistence, file management, and PDF/Markdown export.

**Architecture:** Client-side SvelteKit SPA. Browser fetches LLM endpoint directly (no server proxy). D3.js renders context-dependent visualizations. Dexie.js persists concept files and settings in IndexedDB.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, D3.js, Dexie.js, Tailwind CSS 4, Vitest, Playwright

---

### Task 1: Scaffold SvelteKit Project

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`

**Step 1: Create SvelteKit project**

Run:
```bash
npx sv create . --template minimal --types ts --no-add-ons --no-install
```

Expected: SvelteKit project scaffolded in current directory.

**Step 2: Install dependencies**

Run:
```bash
npm install
```

Expected: `node_modules` created, `package-lock.json` generated.

**Step 3: Install project dependencies**

Run:
```bash
npm install d3 dexie uuid jszip
npm install -D @types/d3 @types/uuid @sveltejs/adapter-static tailwindcss @tailwindcss/vite fake-indexeddb jsdom
```

Expected: All dependencies in `package.json`.

**Step 4: Configure Tailwind CSS**

Replace contents of `src/app.css` with:
```css
@import 'tailwindcss';
```

Add Tailwind Vite plugin in `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit()
  ]
});
```

**Step 5: Configure static adapter for SPA mode**

Update `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
```

**Step 6: Add prerender config for SPA**

Create `src/routes/+layout.ts`:
```typescript
export const prerender = false;
export const ssr = false;
```

**Step 7: Verify dev server starts**

Run: `npm run dev -- --port 5173`
Expected: Server starts at `http://localhost:5173`, page loads without errors.

**Step 8: Create .gitignore and commit**

Create `.gitignore` with standard SvelteKit ignores:
```
node_modules
.svelte-kit
build
dist
.env
.env.*
```

Run:
```bash
git add -A && git commit -m "feat: scaffold SvelteKit project with Tailwind and dependencies"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Write shared type definitions**

Create `src/lib/types.ts`:

```typescript
export type VisualizationType = 'graph' | 'tree' | 'flowchart' | 'hierarchy';

export interface VisualizationNode {
  id: string;
  label: string;
  type?: string;
  group?: string;
  details?: string;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface VisualizationSchema {
  type: VisualizationType;
  title: string;
  description: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata: {
    concepts: string[];
    relationships: string[];
  };
}

export interface ConceptFile {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  text: string;
  visualization: VisualizationSchema | null;
  settings: {
    autoSend: boolean;
    vizType?: VisualizationType;
  };
}

export interface AppSettings {
  id: string;           // singleton key, always 'app-settings'
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light'
};
```

**Step 2: Commit**

Run:
```bash
git add src/lib/types.ts && git commit -m "feat: add shared type definitions"
```

---

### Task 3: Database Layer (Dexie)

**Files:**
- Create: `src/lib/db/index.ts`
- Test: `src/lib/db/index.test.ts`

**Step 1: Write failing test for database initialization**

Create `src/lib/db/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

describe('ConceptDB', () => {
  beforeEach(async () => {
    await db.files.clear();
    await db.settings.clear();
  });

  it('should create a concept file', async () => {
    const id = await db.files.add({
      id: 'test-1',
      title: 'Test Concept',
      createdAt: new Date(),
      updatedAt: new Date(),
      text: '',
      visualization: null,
      settings: { autoSend: false }
    });
    expect(id).toBe('test-1');

    const file = await db.files.get('test-1');
    expect(file?.title).toBe('Test Concept');
  });

  it('should store and retrieve app settings', async () => {
    await db.settings.put({
      id: 'app-settings',
      llmEndpoint: 'http://localhost:11434/v1',
      llmModel: 'llama3.2',
      theme: 'light'
    });

    const settings = await db.settings.get('app-settings');
    expect(settings?.llmEndpoint).toBe('http://localhost:11434/v1');
  });

  it('should list files sorted by updatedAt', async () => {
    const now = new Date();
    await db.files.bulkAdd([
      {
        id: 'old',
        title: 'Old',
        createdAt: new Date(now.getTime() - 2000),
        updatedAt: new Date(now.getTime() - 2000),
        text: '',
        visualization: null,
        settings: { autoSend: false }
      },
      {
        id: 'new',
        title: 'New',
        createdAt: now,
        updatedAt: now,
        text: '',
        visualization: null,
        settings: { autoSend: false }
      }
    ]);

    const files = await db.files.orderBy('updatedAt').reverse().toArray();
    expect(files[0].id).toBe('new');
    expect(files[1].id).toBe('old');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/index.test.ts`
Expected: FAIL — module `./index` not found.

**Step 3: Implement the database**

Create `src/lib/db/index.ts`:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { ConceptFile, AppSettings } from '$lib/types';

class ConceptDB extends Dexie {
  files!: EntityTable<ConceptFile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('ConceptVisualizerDB');
    this.version(1).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
  }
}

export const db = new ConceptDB();
```

**Step 4: Configure Vitest**

Ensure `vite.config.ts` has test config.

Create `vitest.setup.ts` in project root:
```typescript
import 'fake-indexeddb/auto';
```

Add to `vite.config.ts`:
```typescript
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['vitest.setup.ts'],
    environment: 'jsdom'
  }
});
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/db/index.test.ts`
Expected: All 3 tests PASS.

**Step 6: Commit**

Run:
```bash
git add src/lib/db/ vitest.setup.ts vite.config.ts package.json package-lock.json && git commit -m "feat: add Dexie database layer with tests"
```

---

### Task 4: Svelte Stores

**Files:**
- Create: `src/lib/stores/files.ts`, `src/lib/stores/visualization.ts`, `src/lib/stores/settings.ts`
- Test: `src/lib/stores/files.test.ts`, `src/lib/stores/settings.test.ts`

**Step 1: Write failing test for files store**

Create `src/lib/stores/files.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { filesStore } from './files';
import { db } from '$lib/db';

describe('filesStore', () => {
  beforeEach(async () => {
    await db.files.clear();
  });

  it('should create a new file and set it as active', async () => {
    const file = await filesStore.create('Test Concept');
    expect(file.title).toBe('Test Concept');
    expect(file.text).toBe('');
    expect(file.visualization).toBeNull();

    const state = get(filesStore);
    expect(state.activeFileId).toBe(file.id);
    expect(state.files).toHaveLength(1);
  });

  it('should delete a file', async () => {
    const file = await filesStore.create('To Delete');
    await filesStore.remove(file.id);

    const state = get(filesStore);
    expect(state.files).toHaveLength(0);
    expect(state.activeFileId).toBeNull();
  });

  it('should update file text', async () => {
    const file = await filesStore.create('Editable');
    await filesStore.updateText(file.id, 'Hello world');

    const updated = await db.files.get(file.id);
    expect(updated?.text).toBe('Hello world');
  });

  it('should rename a file', async () => {
    const file = await filesStore.create('Old Name');
    await filesStore.rename(file.id, 'New Name');

    const state = get(filesStore);
    const found = state.files.find(f => f.id === file.id);
    expect(found?.title).toBe('New Name');
  });

  it('should load files on init', async () => {
    await db.files.add({
      id: 'preexisting',
      title: 'Pre-existing',
      createdAt: new Date(),
      updatedAt: new Date(),
      text: 'hello',
      visualization: null,
      settings: { autoSend: false }
    });

    await filesStore.init();
    const state = get(filesStore);
    expect(state.files).toHaveLength(1);
    expect(state.files[0].id).toBe('preexisting');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/files.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement files store**

Create `src/lib/stores/files.ts`:

```typescript
import { writable, get } from 'svelte/store';
import { v4 as uuid } from 'uuid';
import { db } from '$lib/db';
import type { ConceptFile, VisualizationSchema } from '$lib/types';

interface FilesState {
  files: ConceptFile[];
  activeFileId: string | null;
}

function createFilesStore() {
  const { subscribe, set, update } = writable<FilesState>({
    files: [],
    activeFileId: null
  });

  async function init() {
    const files = await db.files.orderBy('updatedAt').reverse().toArray();
    const state = get({ subscribe });
    set({
      files,
      activeFileId: state.activeFileId ?? files[0]?.id ?? null
    });
  }

  async function create(title: string): Promise<ConceptFile> {
    const now = new Date();
    const file: ConceptFile = {
      id: uuid(),
      title,
      createdAt: now,
      updatedAt: now,
      text: '',
      visualization: null,
      settings: { autoSend: false }
    };
    await db.files.add(file);
    update(s => ({
      files: [file, ...s.files],
      activeFileId: file.id
    }));
    return file;
  }

  async function remove(id: string) {
    await db.files.delete(id);
    update(s => {
      const files = s.files.filter(f => f.id !== id);
      return {
        files,
        activeFileId: s.activeFileId === id ? (files[0]?.id ?? null) : s.activeFileId
      };
    });
  }

  async function rename(id: string, title: string) {
    const now = new Date();
    await db.files.update(id, { title, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, title, updatedAt: now } : f)
    }));
  }

  async function updateText(id: string, text: string) {
    const now = new Date();
    await db.files.update(id, { text, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, text, updatedAt: now } : f)
    }));
  }

  async function updateVisualization(id: string, visualization: VisualizationSchema) {
    const now = new Date();
    await db.files.update(id, { visualization, updatedAt: now });
    update(s => ({
      ...s,
      files: s.files.map(f => f.id === id ? { ...f, visualization, updatedAt: now } : f)
    }));
  }

  function setActive(id: string) {
    update(s => ({ ...s, activeFileId: id }));
  }

  return {
    subscribe,
    init,
    create,
    remove,
    rename,
    updateText,
    updateVisualization,
    setActive
  };
}

export const filesStore = createFilesStore();
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stores/files.test.ts`
Expected: All 5 tests PASS.

**Step 5: Implement settings store**

Create `src/lib/stores/settings.ts`:

```typescript
import { writable } from 'svelte/store';
import { db } from '$lib/db';
import { DEFAULT_SETTINGS, type AppSettings } from '$lib/types';

function createSettingsStore() {
  const { subscribe, set } = writable<AppSettings>(DEFAULT_SETTINGS);

  async function init() {
    const stored = await db.settings.get('app-settings');
    if (stored) {
      set(stored);
    } else {
      await db.settings.put(DEFAULT_SETTINGS);
    }
  }

  async function save(changes: Partial<Omit<AppSettings, 'id'>>) {
    const updated = { ...DEFAULT_SETTINGS, ...changes, id: 'app-settings' } as AppSettings;
    await db.settings.put(updated);
    set(updated);
  }

  return { subscribe, init, update: save };
}

export const settingsStore = createSettingsStore();
```

**Step 6: Implement visualization store**

Create `src/lib/stores/visualization.ts`:

```typescript
import { writable } from 'svelte/store';
import type { VisualizationSchema } from '$lib/types';

interface VizState {
  current: VisualizationSchema | null;
  loading: boolean;
  error: string | null;
}

function createVisualizationStore() {
  const { subscribe, set, update } = writable<VizState>({
    current: null,
    loading: false,
    error: null
  });

  function setLoading() {
    update(s => ({ ...s, loading: true, error: null }));
  }

  function setVisualization(viz: VisualizationSchema) {
    set({ current: viz, loading: false, error: null });
  }

  function setError(error: string) {
    update(s => ({ ...s, loading: false, error }));
  }

  function clear() {
    set({ current: null, loading: false, error: null });
  }

  return { subscribe, setLoading, setVisualization, setError, clear };
}

export const vizStore = createVisualizationStore();
```

**Step 7: Write and run settings store test**

Create `src/lib/stores/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { settingsStore } from './settings';
import { db } from '$lib/db';
import { DEFAULT_SETTINGS } from '$lib/types';

describe('settingsStore', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it('should initialize with defaults when no settings exist', async () => {
    await settingsStore.init();
    const settings = get(settingsStore);
    expect(settings.llmEndpoint).toBe(DEFAULT_SETTINGS.llmEndpoint);
    expect(settings.llmModel).toBe(DEFAULT_SETTINGS.llmModel);
  });

  it('should persist updated settings', async () => {
    await settingsStore.init();
    await settingsStore.update({ llmEndpoint: 'http://custom:8080/v1' });

    const settings = get(settingsStore);
    expect(settings.llmEndpoint).toBe('http://custom:8080/v1');

    const stored = await db.settings.get('app-settings');
    expect(stored?.llmEndpoint).toBe('http://custom:8080/v1');
  });
});
```

Run: `npx vitest run src/lib/stores/`
Expected: All store tests PASS.

**Step 8: Commit**

Run:
```bash
git add src/lib/stores/ && git commit -m "feat: add Svelte stores for files, visualization, and settings"
```

---

### Task 5: LLM Client

**Files:**
- Create: `src/lib/llm/client.ts`, `src/lib/llm/prompts.ts`, `src/lib/llm/parser.ts`
- Test: `src/lib/llm/parser.test.ts`

**Step 1: Write the system prompt**

Create `src/lib/llm/prompts.ts`:

```typescript
export const SYSTEM_PROMPT = `You are a concept visualization assistant. Given explanatory text, you extract concepts and their relationships, then output a structured JSON visualization.

You MUST respond with ONLY valid JSON matching this exact schema — no markdown, no explanation, no wrapping:

{
  "type": "graph" | "tree" | "flowchart" | "hierarchy",
  "title": "Short title for the visualization",
  "description": "One-sentence summary",
  "nodes": [
    {
      "id": "unique-id",
      "label": "Display Label",
      "type": "concept | process | decision | category",
      "group": "optional-group-name",
      "details": "Optional longer description"
    }
  ],
  "edges": [
    {
      "source": "node-id",
      "target": "node-id",
      "label": "relationship label",
      "type": "causes | contains | precedes | relates"
    }
  ],
  "metadata": {
    "concepts": ["list", "of", "key", "concepts"],
    "relationships": ["Human-readable relationship summary sentences"]
  }
}

Choose the visualization type that best fits the content:
- "graph": For interconnected concepts with many-to-many relationships
- "tree": For hierarchical knowledge with parent-child structure
- "flowchart": For sequential processes or decision flows
- "hierarchy": For taxonomies or classification systems

Rules:
- Every node must have a unique id and a label
- Every edge must reference valid node ids
- Include 3-15 nodes depending on content complexity
- Respond with ONLY the JSON object`;

export function buildUserPrompt(text: string): string {
  return `Analyze the following text and create a concept visualization:\n\n${text}`;
}
```

**Step 2: Write failing test for parser**

Create `src/lib/llm/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseVisualizationResponse } from './parser';

const VALID_RESPONSE = JSON.stringify({
  type: 'graph',
  title: 'Test',
  description: 'A test visualization',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' }
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects' }
  ],
  metadata: {
    concepts: ['Node A', 'Node B'],
    relationships: ['Node A connects to Node B']
  }
});

describe('parseVisualizationResponse', () => {
  it('should parse valid JSON response', () => {
    const result = parseVisualizationResponse(VALID_RESPONSE);
    expect(result.type).toBe('graph');
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('should extract JSON from markdown code blocks', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const result = parseVisualizationResponse(wrapped);
    expect(result.type).toBe('graph');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseVisualizationResponse('not json')).toThrow();
  });

  it('should throw when required fields are missing', () => {
    expect(() => parseVisualizationResponse('{"type":"graph"}')).toThrow();
  });

  it('should throw when edge references invalid node', () => {
    const bad = JSON.stringify({
      type: 'graph',
      title: 'Test',
      description: 'Test',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'nonexistent' }],
      metadata: { concepts: [], relationships: [] }
    });
    expect(() => parseVisualizationResponse(bad)).toThrow();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/llm/parser.test.ts`
Expected: FAIL — module not found.

**Step 4: Implement parser**

Create `src/lib/llm/parser.ts`:

```typescript
import type { VisualizationSchema } from '$lib/types';

const VALID_TYPES = ['graph', 'tree', 'flowchart', 'hierarchy'];

export function parseVisualizationResponse(raw: string): VisualizationSchema {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM response is not valid JSON');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate required fields
  if (!obj.type || !VALID_TYPES.includes(obj.type as string)) {
    throw new Error(`Invalid visualization type: ${obj.type}`);
  }
  if (!obj.title || typeof obj.title !== 'string') {
    throw new Error('Missing or invalid title');
  }
  if (!obj.description || typeof obj.description !== 'string') {
    throw new Error('Missing or invalid description');
  }
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error('Missing or empty nodes array');
  }
  if (!Array.isArray(obj.edges)) {
    throw new Error('Missing edges array');
  }
  if (!obj.metadata || typeof obj.metadata !== 'object') {
    throw new Error('Missing metadata object');
  }

  const nodeIds = new Set((obj.nodes as Array<{ id: string }>).map(n => n.id));

  for (const edge of obj.edges as Array<{ source: string; target: string }>) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge references invalid source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge references invalid target node: ${edge.target}`);
    }
  }

  return parsed as VisualizationSchema;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/llm/parser.test.ts`
Expected: All 5 tests PASS.

**Step 6: Implement LLM client**

Create `src/lib/llm/client.ts`:

```typescript
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { parseVisualizationResponse } from './parser';
import type { VisualizationSchema } from '$lib/types';

interface LLMClientConfig {
  endpoint: string;
  model: string;
}

export async function generateVisualization(
  text: string,
  config: LLMClientConfig
): Promise<VisualizationSchema> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(text) }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return parseVisualizationResponse(content);
}
```

**Step 7: Commit**

Run:
```bash
git add src/lib/llm/ && git commit -m "feat: add LLM client, prompts, and response parser with tests"
```

---

### Task 6: Two-Pane Layout Shell

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Create: `src/lib/components/AppShell.svelte`

**Step 1: Create the app shell component**

Create `src/lib/components/AppShell.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    sidebar?: Snippet;
    main: Snippet;
    editor: Snippet;
  }

  let { sidebar, main, editor }: Props = $props();
</script>

<div class="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
  {#if sidebar}
    <aside class="w-56 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
      <div class="flex-1 overflow-y-auto">
        {@render sidebar()}
      </div>
      <div class="p-3 border-t border-gray-200">
        <a href="/settings" class="text-xs text-gray-400 hover:text-gray-600">Settings</a>
      </div>
    </aside>
  {/if}

  <main class="flex-1 min-w-0 overflow-hidden">
    {@render main()}
  </main>

  <aside class="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
    {@render editor()}
  </aside>
</div>
```

**Step 2: Update layout to import global styles**

Update `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
```

**Step 3: Create initial page with layout**

Update `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
</script>

<AppShell>
  {#snippet main()}
    <div class="flex items-center justify-center h-full text-gray-400">
      <p class="text-lg">Visualization canvas</p>
    </div>
  {/snippet}

  {#snippet editor()}
    <div class="p-4">
      <p class="text-sm text-gray-500">Editor pane</p>
    </div>
  {/snippet}
</AppShell>
```

**Step 4: Verify layout renders correctly**

Run: `npm run dev -- --port 5173`
Visit `http://localhost:5173`. Expected: two-pane layout — large left area, 420px right sidebar.

**Step 5: Commit**

Run:
```bash
git add src/ && git commit -m "feat: add two-pane layout shell with AppShell component"
```

---

### Task 7: Editor Pane

**Files:**
- Create: `src/lib/components/editor/ConceptDetails.svelte`
- Create: `src/lib/components/editor/TextEditor.svelte`
- Create: `src/lib/components/editor/EditorPane.svelte`

**Step 1: Create ConceptDetails component**

Displays extracted concepts and relationships at the top of the editor pane.

Create `src/lib/components/editor/ConceptDetails.svelte`:

```svelte
<script lang="ts">
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
  }

  let { visualization }: Props = $props();
</script>

{#if visualization}
  <div class="border-b border-gray-200 p-4 space-y-3">
    <div>
      <h2 class="font-semibold text-sm text-gray-900">{visualization.title}</h2>
      <p class="text-xs text-gray-500 mt-0.5">{visualization.description}</p>
    </div>

    {#if visualization.metadata.concepts.length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Concepts</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each visualization.metadata.concepts as concept}
            <span class="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
              {concept}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if visualization.metadata.relationships.length > 0}
      <div>
        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Relationships</h3>
        <ul class="space-y-0.5">
          {#each visualization.metadata.relationships as rel}
            <li class="text-xs text-gray-600">{rel}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
```

**Step 2: Create TextEditor component**

Create `src/lib/components/editor/TextEditor.svelte`:

```svelte
<script lang="ts">
  import type { ConceptFile } from '$lib/types';

  interface Props {
    text: string;
    onchange: (text: string) => void;
    onvisualize: () => void;
    loading: boolean;
    autoSend: boolean;
    onAutoSendToggle: (enabled: boolean) => void;
    file: ConceptFile | undefined;
  }

  let { text, onchange, onvisualize, loading, autoSend, onAutoSendToggle, file }: Props = $props();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    onchange(value);

    if (autoSend) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onvisualize(), 2000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onvisualize();
    }
  }
</script>

<div class="flex-1 flex flex-col p-4 gap-3">
  <textarea
    class="flex-1 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
    placeholder="Describe a concept to visualize..."
    value={text}
    oninput={handleInput}
    onkeydown={handleKeydown}
    disabled={loading}
  ></textarea>

  <div class="flex items-center justify-between">
    <label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
      <input
        type="checkbox"
        checked={autoSend}
        onchange={(e) => onAutoSendToggle((e.target as HTMLInputElement).checked)}
        class="rounded border-gray-300"
      />
      Auto-visualize
    </label>

    <div class="flex items-center gap-2">
      <button
        onclick={onvisualize}
        disabled={loading || !text.trim()}
        class="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Generating...' : 'Visualize'}
        {#if !loading}
          <kbd class="ml-1.5 text-[10px] opacity-70">Cmd+Enter</kbd>
        {/if}
      </button>
    </div>
  </div>
</div>
```

**Step 3: Create EditorPane container**

Create `src/lib/components/editor/EditorPane.svelte`:

```svelte
<script lang="ts">
  import ConceptDetails from './ConceptDetails.svelte';
  import TextEditor from './TextEditor.svelte';
  import ExportMenu from '$lib/components/export/ExportMenu.svelte';
  import type { VisualizationSchema, ConceptFile } from '$lib/types';

  interface Props {
    text: string;
    visualization: VisualizationSchema | null;
    loading: boolean;
    autoSend: boolean;
    file: ConceptFile | undefined;
    onTextChange: (text: string) => void;
    onVisualize: () => void;
    onAutoSendToggle: (enabled: boolean) => void;
  }

  let { text, visualization, loading, autoSend, file, onTextChange, onVisualize, onAutoSendToggle }: Props = $props();
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-3 border-b border-gray-200">
    <h2 class="text-sm font-medium text-gray-700 truncate">{file?.title ?? 'No file selected'}</h2>
    <ExportMenu {file} />
  </div>

  <ConceptDetails {visualization} />

  <TextEditor
    {text}
    onchange={onTextChange}
    onvisualize={onVisualize}
    {loading}
    {autoSend}
    {onAutoSendToggle}
    {file}
  />
</div>
```

**Step 4: Verify components render**

Wire up `+page.svelte` with the editor pane using dummy data, verify in browser.

**Step 5: Commit**

Run:
```bash
git add src/lib/components/editor/ && git commit -m "feat: add editor pane with concept details and text editor"
```

---

### Task 8: File Management Sidebar

**Files:**
- Create: `src/lib/components/files/FileList.svelte`
- Create: `src/lib/components/files/FileItem.svelte`

**Step 1: Create FileItem component**

Create `src/lib/components/files/FileItem.svelte`:

```svelte
<script lang="ts">
  import type { ConceptFile } from '$lib/types';

  interface Props {
    file: ConceptFile;
    active: boolean;
    onclick: () => void;
    onrename: (title: string) => void;
    ondelete: () => void;
  }

  let { file, active, onclick, onrename, ondelete }: Props = $props();
  let editing = $state(false);
  let editTitle = $state(file.title);

  function startEditing(e: MouseEvent) {
    e.stopPropagation();
    editing = true;
    editTitle = file.title;
  }

  function finishEditing() {
    editing = false;
    if (editTitle.trim() && editTitle !== file.title) {
      onrename(editTitle.trim());
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') finishEditing();
    if (e.key === 'Escape') { editing = false; }
  }
</script>

<button
  class="w-full text-left px-3 py-2 text-sm rounded-md transition-colors group
    {active ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-100'}"
  onclick={onclick}
>
  {#if editing}
    <input
      class="w-full bg-white border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
      bind:value={editTitle}
      onblur={finishEditing}
      onkeydown={handleKeydown}
      autofocus
    />
  {:else}
    <div class="flex items-center justify-between">
      <span class="truncate">{file.title}</span>
      <span class="hidden group-hover:flex gap-1">
        <button onclick={startEditing} class="text-gray-400 hover:text-gray-600 text-xs" title="Rename">
          &#9998;
        </button>
        <button onclick={(e) => { e.stopPropagation(); ondelete(); }} class="text-gray-400 hover:text-red-500 text-xs" title="Delete">
          &times;
        </button>
      </span>
    </div>
    <span class="text-[10px] text-gray-400">
      {file.updatedAt.toLocaleDateString()}
    </span>
  {/if}
</button>
```

**Step 2: Create FileList component**

Create `src/lib/components/files/FileList.svelte`:

```svelte
<script lang="ts">
  import type { ConceptFile } from '$lib/types';
  import FileItem from './FileItem.svelte';

  interface Props {
    files: ConceptFile[];
    activeFileId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
  }

  let { files, activeFileId, onSelect, onCreate, onRename, onDelete }: Props = $props();
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-3 border-b border-gray-200">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Files</h2>
    <button
      onclick={onCreate}
      class="text-sm text-blue-600 hover:text-blue-800 font-medium"
      title="New file"
    >
      + New
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
    {#each files as file (file.id)}
      <FileItem
        {file}
        active={file.id === activeFileId}
        onclick={() => onSelect(file.id)}
        onrename={(title) => onRename(file.id, title)}
        ondelete={() => onDelete(file.id)}
      />
    {/each}

    {#if files.length === 0}
      <p class="text-xs text-gray-400 text-center py-4">No files yet</p>
    {/if}
  </div>
</div>
```

**Step 3: Commit**

Run:
```bash
git add src/lib/components/files/ && git commit -m "feat: add file management sidebar components"
```

---

### Task 9: D3 Visualization Renderers

**Files:**
- Create: `src/lib/components/visualizer/VisualizerCanvas.svelte`
- Create: `src/lib/components/visualizer/renderers/graph.ts`
- Create: `src/lib/components/visualizer/renderers/tree.ts`
- Create: `src/lib/components/visualizer/renderers/flowchart.ts`
- Create: `src/lib/components/visualizer/renderers/hierarchy.ts`
- Create: `src/lib/components/visualizer/renderers/index.ts`
- Test: `src/lib/components/visualizer/renderers/graph.test.ts`

This is the most complex task. Each renderer is a function that takes an SVG element and a `VisualizationSchema`, then renders D3 content into it.

**Step 1: Write failing test for graph renderer**

Create `src/lib/components/visualizer/renderers/graph.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderGraph } from './graph';
import type { VisualizationSchema } from '$lib/types';

const mockSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test Graph',
  description: 'A test',
  nodes: [
    { id: 'a', label: 'Node A', group: 'g1' },
    { id: 'b', label: 'Node B', group: 'g1' },
    { id: 'c', label: 'Node C', group: 'g2' }
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects' },
    { source: 'b', target: 'c', label: 'leads to' }
  ],
  metadata: {
    concepts: ['Node A', 'Node B', 'Node C'],
    relationships: ['A connects B', 'B leads to C']
  }
};

describe('renderGraph', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    dom.window.document.body.appendChild(svg);
  });

  it('should render nodes and edges into svg', () => {
    renderGraph(svg, mockSchema);
    const circles = svg.querySelectorAll('circle');
    const lines = svg.querySelectorAll('line');
    expect(circles.length).toBe(3);
    expect(lines.length).toBe(2);
  });

  it('should render node labels', () => {
    renderGraph(svg, mockSchema);
    const texts = svg.querySelectorAll('text');
    const labels = Array.from(texts).map(t => t.textContent);
    expect(labels).toContain('Node A');
    expect(labels).toContain('Node B');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/visualizer/renderers/graph.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement graph renderer**

Create `src/lib/components/visualizer/renderers/graph.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function groupColor(group: string | undefined, groups: string[]): string {
  if (!group) return COLORS[0];
  const idx = groups.indexOf(group);
  return COLORS[idx % COLORS.length];
}

export function renderGraph(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');

  const groups = [...new Set(schema.nodes.map(n => n.group).filter(Boolean))] as string[];

  const nodes = schema.nodes.map(n => ({ ...n }));
  const edges = schema.edges.map(e => ({ source: e.source, target: e.target, label: e.label }));

  const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40));

  const g = svg.append('g');

  // Zoom
  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Edges
  const link = g.append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1.5);

  // Edge labels
  const edgeLabels = g.append('g')
    .selectAll('text')
    .data(edges)
    .join('text')
    .text(d => d.label || '')
    .attr('font-size', '10px')
    .attr('fill', '#9ca3af')
    .attr('text-anchor', 'middle');

  // Nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 20)
    .attr('fill', d => groupColor(d.group, groups))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .call(drag(simulation) as any);

  // Node labels
  const labels = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.label)
    .attr('font-size', '12px')
    .attr('fill', '#1f2937')
    .attr('text-anchor', 'middle')
    .attr('dy', 35);

  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    edgeLabels
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y);
  });
}

function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
  return d3.drag()
    .on('start', (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on('drag', (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });
}
```

**Step 4: Implement tree renderer**

Create `src/lib/components/visualizer/renderers/tree.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

export function renderTree(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const margin = { top: 40, right: 40, bottom: 40, left: 40 };

  // Build hierarchy from nodes + edges
  const nodeMap = new Map(schema.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
  const childIds = new Set(schema.edges.map(e => e.target));
  const rootId = schema.nodes.find(n => !childIds.has(n.id))?.id || schema.nodes[0]?.id;

  for (const edge of schema.edges) {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) parent.children.push(child);
  }

  const rootData = nodeMap.get(rootId);
  if (!rootData) return;

  const root = d3.hierarchy(rootData);
  const treeLayout = d3.tree().size([
    width - margin.left - margin.right,
    height - margin.top - margin.bottom
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Zoom
  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Links
  g.selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', d3.linkVertical()
      .x((d: any) => d.x)
      .y((d: any) => d.y) as any)
    .attr('fill', 'none')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

  nodeG.append('circle')
    .attr('r', 18)
    .attr('fill', '#3b82f6')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', '11px')
    .attr('fill', '#1f2937')
    .attr('text-anchor', 'middle')
    .attr('dy', 32);
}
```

**Step 5: Implement flowchart renderer**

Create `src/lib/components/visualizer/renderers/flowchart.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 50;
const GAP_X = 60;
const GAP_Y = 80;

export function renderFlowchart(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');

  // Topological sort for positioning
  const positions = new Map<string, { x: number; y: number }>();
  const inDegree = new Map<string, number>();
  schema.nodes.forEach(n => inDegree.set(n.id, 0));
  schema.edges.forEach(e => inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1));

  const queue = schema.nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  let row = 0;
  const visited = new Set<string>();

  while (queue.length > 0) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const col = i - (levelSize - 1) / 2;
      positions.set(nodeId, {
        x: width / 2 + col * (NODE_WIDTH + GAP_X),
        y: 60 + row * (NODE_HEIGHT + GAP_Y)
      });

      schema.edges
        .filter(e => e.source === nodeId)
        .forEach(e => {
          const deg = (inDegree.get(e.target) || 1) - 1;
          inDegree.set(e.target, deg);
          if (deg === 0) queue.push(e.target);
        });
    }
    row++;
  }

  // Place any unvisited nodes
  schema.nodes.forEach(n => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: width / 2, y: 60 + row * (NODE_HEIGHT + GAP_Y) });
      row++;
    }
  });

  const g = svg.append('g');

  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Arrows
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#9ca3af');

  // Edges
  g.selectAll('line')
    .data(schema.edges)
    .join('line')
    .attr('x1', d => positions.get(d.source)?.x || 0)
    .attr('y1', d => (positions.get(d.source)?.y || 0) + NODE_HEIGHT / 2)
    .attr('x2', d => positions.get(d.target)?.x || 0)
    .attr('y2', d => (positions.get(d.target)?.y || 0) - NODE_HEIGHT / 2)
    .attr('stroke', '#9ca3af')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)');

  // Edge labels
  g.selectAll('text.edge-label')
    .data(schema.edges)
    .join('text')
    .attr('class', 'edge-label')
    .text(d => d.label || '')
    .attr('x', d => ((positions.get(d.source)?.x || 0) + (positions.get(d.target)?.x || 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y || 0) + (positions.get(d.target)?.y || 0)) / 2)
    .attr('font-size', '10px')
    .attr('fill', '#6b7280')
    .attr('text-anchor', 'middle');

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => {
      const pos = positions.get(d.id) || { x: 0, y: 0 };
      return `translate(${pos.x - NODE_WIDTH / 2},${pos.y - NODE_HEIGHT / 2})`;
    });

  nodeG.append('rect')
    .attr('width', NODE_WIDTH)
    .attr('height', NODE_HEIGHT)
    .attr('rx', d => d.type === 'decision' ? 0 : 8)
    .attr('fill', d => d.type === 'decision' ? '#fef3c7' : '#eff6ff')
    .attr('stroke', d => d.type === 'decision' ? '#f59e0b' : '#3b82f6')
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .text(d => d.label)
    .attr('x', NODE_WIDTH / 2)
    .attr('y', NODE_HEIGHT / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '12px')
    .attr('fill', '#1f2937');
}
```

**Step 6: Implement hierarchy renderer**

Create `src/lib/components/visualizer/renderers/hierarchy.ts`:

```typescript
import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

export function renderHierarchy(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const margin = { top: 20, right: 120, bottom: 20, left: 120 };

  // Build hierarchy (horizontal tree layout)
  const nodeMap = new Map(schema.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
  const childIds = new Set(schema.edges.map(e => e.target));
  const rootId = schema.nodes.find(n => !childIds.has(n.id))?.id || schema.nodes[0]?.id;

  for (const edge of schema.edges) {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) parent.children.push(child);
  }

  const rootData = nodeMap.get(rootId);
  if (!rootData) return;

  const root = d3.hierarchy(rootData);
  const treeLayout = d3.tree().size([
    height - margin.top - margin.bottom,
    width - margin.left - margin.right
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Links (horizontal)
  g.selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', d3.linkHorizontal()
      .x((d: any) => d.y)
      .y((d: any) => d.x) as any)
    .attr('fill', 'none')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

  nodeG.append('circle')
    .attr('r', 6)
    .attr('fill', (d: any) => d.children ? '#3b82f6' : '#10b981');

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', '12px')
    .attr('fill', '#1f2937')
    .attr('dx', (d: any) => d.children ? -12 : 12)
    .attr('dy', 4)
    .attr('text-anchor', (d: any) => d.children ? 'end' : 'start');
}
```

**Step 7: Create renderer index**

Create `src/lib/components/visualizer/renderers/index.ts`:

```typescript
import type { VisualizationSchema, VisualizationType } from '$lib/types';
import { renderGraph } from './graph';
import { renderTree } from './tree';
import { renderFlowchart } from './flowchart';
import { renderHierarchy } from './hierarchy';

type Renderer = (svg: SVGSVGElement, schema: VisualizationSchema) => void;

const renderers: Record<VisualizationType, Renderer> = {
  graph: renderGraph,
  tree: renderTree,
  flowchart: renderFlowchart,
  hierarchy: renderHierarchy
};

export function renderVisualization(svg: SVGSVGElement, schema: VisualizationSchema): void {
  const renderer = renderers[schema.type];
  if (!renderer) {
    throw new Error(`Unknown visualization type: ${schema.type}`);
  }
  renderer(svg, schema);
}
```

**Step 8: Create VisualizerCanvas Svelte component**

Create `src/lib/components/visualizer/VisualizerCanvas.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { renderVisualization } from './renderers';
  import type { VisualizationSchema } from '$lib/types';

  interface Props {
    visualization: VisualizationSchema | null;
    error: string | null;
    loading: boolean;
  }

  let { visualization, error, loading }: Props = $props();

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;

  function render() {
    if (!svgEl || !visualization) return;
    const rect = containerEl.getBoundingClientRect();
    svgEl.setAttribute('width', String(rect.width));
    svgEl.setAttribute('height', String(rect.height));
    renderVisualization(svgEl, visualization);
  }

  $effect(() => {
    if (visualization) render();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => {
      if (visualization) render();
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div bind:this={containerEl} class="w-full h-full relative">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
      <div class="flex items-center gap-2 text-gray-500">
        <div class="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span class="text-sm">Generating visualization...</span>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center max-w-md">
        <p class="text-red-500 text-sm font-medium">Visualization Error</p>
        <p class="text-gray-500 text-xs mt-1">{error}</p>
      </div>
    </div>
  {/if}

  {#if !visualization && !loading && !error}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-gray-400">
        <p class="text-lg font-light">Concept Visualizer</p>
        <p class="text-sm mt-1">Write a concept in the editor and click Visualize</p>
      </div>
    </div>
  {/if}

  <svg bind:this={svgEl} class="w-full h-full"></svg>
</div>
```

**Step 9: Run graph test**

Run: `npx vitest run src/lib/components/visualizer/renderers/graph.test.ts`
Expected: PASS (both tests).

**Step 10: Commit**

Run:
```bash
git add src/lib/components/visualizer/ && git commit -m "feat: add D3 visualization renderers for graph, tree, flowchart, hierarchy"
```

---

### Task 10: Wire Everything Together on the Main Page

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Connect stores, components, and LLM client**

Update `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import EditorPane from '$lib/components/editor/EditorPane.svelte';
  import VisualizerCanvas from '$lib/components/visualizer/VisualizerCanvas.svelte';
  import FileList from '$lib/components/files/FileList.svelte';
  import { filesStore } from '$lib/stores/files';
  import { vizStore } from '$lib/stores/visualization';
  import { settingsStore } from '$lib/stores/settings';
  import { generateVisualization } from '$lib/llm/client';
  import type { ConceptFile } from '$lib/types';

  let activeFile: ConceptFile | undefined = $derived(
    $filesStore.files.find(f => f.id === $filesStore.activeFileId)
  );

  onMount(async () => {
    await settingsStore.init();
    await filesStore.init();
  });

  async function handleVisualize() {
    if (!activeFile || !activeFile.text.trim()) return;

    vizStore.setLoading();
    try {
      const viz = await generateVisualization(activeFile.text, {
        endpoint: $settingsStore.llmEndpoint,
        model: $settingsStore.llmModel
      });
      vizStore.setVisualization(viz);
      await filesStore.updateVisualization(activeFile.id, viz);
    } catch (err) {
      vizStore.setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleTextChange(text: string) {
    if (activeFile) {
      filesStore.updateText(activeFile.id, text);
    }
  }

  async function handleCreateFile() {
    await filesStore.create('Untitled Concept');
    vizStore.clear();
  }

  function handleSelectFile(id: string) {
    filesStore.setActive(id);
    const file = $filesStore.files.find(f => f.id === id);
    if (file?.visualization) {
      vizStore.setVisualization(file.visualization);
    } else {
      vizStore.clear();
    }
  }
</script>

<AppShell>
  {#snippet sidebar()}
    <FileList
      files={$filesStore.files}
      activeFileId={$filesStore.activeFileId}
      onSelect={handleSelectFile}
      onCreate={handleCreateFile}
      onRename={(id, title) => filesStore.rename(id, title)}
      onDelete={(id) => filesStore.remove(id)}
    />
  {/snippet}

  {#snippet main()}
    <VisualizerCanvas
      visualization={$vizStore.current}
      error={$vizStore.error}
      loading={$vizStore.loading}
    />
  {/snippet}

  {#snippet editor()}
    <EditorPane
      text={activeFile?.text ?? ''}
      visualization={$vizStore.current}
      loading={$vizStore.loading}
      autoSend={activeFile?.settings.autoSend ?? false}
      file={activeFile}
      onTextChange={handleTextChange}
      onVisualize={handleVisualize}
      onAutoSendToggle={(enabled) => {
        if (activeFile) {
          filesStore.updateText(activeFile.id, activeFile.text);
        }
      }}
    />
  {/snippet}
</AppShell>
```

**Step 2: Verify end-to-end in browser**

Run: `npm run dev -- --port 5173`
Expected: Full app renders — sidebar with "New" button, visualization area, and editor pane. Creating a file, typing text, and clicking Visualize attempts an LLM call.

**Step 3: Commit**

Run:
```bash
git add src/routes/+page.svelte && git commit -m "feat: wire up main page with stores, LLM client, and all components"
```

---

### Task 11: Export (PDF + Markdown)

**Files:**
- Create: `src/lib/export/svg-to-png.ts`
- Create: `src/lib/export/pdf.ts`
- Create: `src/lib/export/markdown.ts`
- Create: `src/lib/components/export/ExportMenu.svelte`

**Step 1: Implement SVG to PNG utility**

Create `src/lib/export/svg-to-png.ts`:

```typescript
export function svgToPng(svgEl: SVGSVGElement, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth * scale;
      canvas.height = svgEl.clientHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = url;
  });
}
```

**Step 2: Implement PDF export using DOM manipulation**

Create `src/lib/export/pdf.ts`:

```typescript
import type { ConceptFile } from '$lib/types';

export function exportPdf(file: ConceptFile): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const doc = printWindow.document;

  // Build head
  const title = doc.createElement('title');
  title.textContent = file.title;
  doc.head.appendChild(title);

  const style = doc.createElement('style');
  style.textContent = [
    'body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1f2937; }',
    'h1 { font-size: 28px; margin-bottom: 8px; }',
    '.description { color: #6b7280; font-size: 14px; margin-bottom: 24px; }',
    '.viz-container { margin: 24px 0; text-align: center; }',
    '.viz-container svg { max-width: 100%; height: auto; }',
    '.concepts { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }',
    '.concept-tag { background: #eff6ff; color: #1e40af; padding: 4px 12px; border-radius: 16px; font-size: 13px; }',
    '.relationships { margin: 16px 0; }',
    '.relationships li { font-size: 13px; color: #4b5563; margin-bottom: 4px; }',
    '.explanation { margin-top: 24px; line-height: 1.7; font-size: 15px; white-space: pre-wrap; }',
    '@media print { body { padding: 0; } }'
  ].join('\n');
  doc.head.appendChild(style);

  // Build body
  const h1 = doc.createElement('h1');
  h1.textContent = file.title;
  doc.body.appendChild(h1);

  if (file.visualization) {
    const desc = doc.createElement('p');
    desc.className = 'description';
    desc.textContent = file.visualization.description;
    doc.body.appendChild(desc);
  }

  // Clone the SVG from the main page into the print window
  const svgEl = document.querySelector('svg');
  if (svgEl) {
    const vizContainer = doc.createElement('div');
    vizContainer.className = 'viz-container';
    const clonedSvg = svgEl.cloneNode(true);
    vizContainer.appendChild(doc.adoptNode(clonedSvg));
    doc.body.appendChild(vizContainer);
  }

  if (file.visualization) {
    const conceptsDiv = doc.createElement('div');
    conceptsDiv.className = 'concepts';
    for (const c of file.visualization.metadata.concepts) {
      const tag = doc.createElement('span');
      tag.className = 'concept-tag';
      tag.textContent = c;
      conceptsDiv.appendChild(tag);
    }
    doc.body.appendChild(conceptsDiv);

    const relList = doc.createElement('ul');
    relList.className = 'relationships';
    for (const r of file.visualization.metadata.relationships) {
      const li = doc.createElement('li');
      li.textContent = r;
      relList.appendChild(li);
    }
    doc.body.appendChild(relList);
  }

  const explanation = doc.createElement('div');
  explanation.className = 'explanation';
  explanation.textContent = file.text;
  doc.body.appendChild(explanation);

  // Trigger print after a short delay to allow rendering
  setTimeout(() => printWindow.print(), 300);
}
```

**Step 3: Implement Markdown export**

Create `src/lib/export/markdown.ts`:

```typescript
import JSZip from 'jszip';
import { svgToPng } from './svg-to-png';
import type { ConceptFile } from '$lib/types';

export async function exportMarkdown(file: ConceptFile): Promise<void> {
  const zip = new JSZip();
  const slug = file.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Generate PNG from current SVG
  const svgEl = document.querySelector('svg');
  let imageName = '';
  if (svgEl) {
    const png = await svgToPng(svgEl as SVGSVGElement);
    imageName = `${slug}-visualization.png`;
    zip.file(imageName, png);
  }

  // Build markdown
  let md = `# ${file.title}\n\n`;

  if (imageName) {
    md += `![${file.title}](./${imageName})\n\n`;
  }

  if (file.visualization) {
    md += `> ${file.visualization.description}\n\n`;

    if (file.visualization.metadata.concepts.length > 0) {
      md += `## Concepts\n\n`;
      file.visualization.metadata.concepts.forEach(c => { md += `- ${c}\n`; });
      md += '\n';
    }

    if (file.visualization.metadata.relationships.length > 0) {
      md += `## Relationships\n\n`;
      file.visualization.metadata.relationships.forEach(r => { md += `- ${r}\n`; });
      md += '\n';
    }
  }

  md += `## Explanation\n\n${file.text}\n`;

  zip.file(`${slug}.md`, md);

  // Download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 4: Create ExportMenu component**

Create `src/lib/components/export/ExportMenu.svelte`:

```svelte
<script lang="ts">
  import { exportPdf } from '$lib/export/pdf';
  import { exportMarkdown } from '$lib/export/markdown';
  import type { ConceptFile } from '$lib/types';

  interface Props {
    file: ConceptFile | undefined;
  }

  let { file }: Props = $props();
  let open = $state(false);

  function handlePdf() {
    if (file) exportPdf(file);
    open = false;
  }

  async function handleMarkdown() {
    if (file) await exportMarkdown(file);
    open = false;
  }
</script>

<div class="relative">
  <button
    onclick={() => open = !open}
    disabled={!file?.visualization}
    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  >
    Export
  </button>

  {#if open}
    <div class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
      <button onclick={handlePdf} class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
        PDF
      </button>
      <button onclick={handleMarkdown} class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
        Markdown + Images
      </button>
    </div>
  {/if}
</div>
```

**Step 5: Commit**

Run:
```bash
git add src/lib/export/ src/lib/components/export/ && git commit -m "feat: add PDF and Markdown export with SVG-to-PNG conversion"
```

---

### Task 12: Settings Page

**Files:**
- Create: `src/routes/settings/+page.svelte`

**Step 1: Create settings page**

Create `src/routes/settings/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { goto } from '$app/navigation';

  let endpoint = $state('');
  let model = $state('');
  let theme = $state<'light' | 'dark'>('light');

  onMount(async () => {
    await settingsStore.init();
    endpoint = $settingsStore.llmEndpoint;
    model = $settingsStore.llmModel;
    theme = $settingsStore.theme;
  });

  async function save() {
    await settingsStore.update({ llmEndpoint: endpoint, llmModel: model, theme });
    goto('/');
  }
</script>

<div class="max-w-lg mx-auto py-12 px-4">
  <h1 class="text-xl font-semibold mb-6">Settings</h1>

  <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-5">
    <div>
      <label for="endpoint" class="block text-sm font-medium text-gray-700 mb-1">LLM Endpoint</label>
      <input
        id="endpoint"
        type="url"
        bind:value={endpoint}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="http://localhost:11434/v1"
      />
      <p class="text-xs text-gray-400 mt-1">OpenAI-compatible API endpoint</p>
    </div>

    <div>
      <label for="model" class="block text-sm font-medium text-gray-700 mb-1">Model</label>
      <input
        id="model"
        type="text"
        bind:value={model}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="llama3.2"
      />
    </div>

    <div>
      <label for="theme" class="block text-sm font-medium text-gray-700 mb-1">Theme</label>
      <select
        id="theme"
        bind:value={theme}
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>

    <div class="flex gap-3 pt-2">
      <button type="submit" class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">
        Save
      </button>
      <a href="/" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
        Cancel
      </a>
    </div>
  </form>
</div>
```

**Step 2: Verify settings page works**

Run: `npm run dev -- --port 5173`
Navigate to `/settings`. Expected: form with endpoint, model, and theme fields. Save persists to IndexedDB.

**Step 3: Commit**

Run:
```bash
git add src/routes/settings/ && git commit -m "feat: add settings page for LLM endpoint configuration"
```

---

## Task Dependency Graph

```
Task 1 (Scaffold)
  ├── Task 2 (Types)
  │     ├── Task 3 (Database) ── Task 4 (Stores)
  │     ├── Task 5 (LLM Client)
  │     ├── Task 9 (D3 Renderers)
  │     └── Task 11 (Export)
  └── Task 6 (Layout)
        ├── Task 7 (Editor Pane)
        ├── Task 8 (File Sidebar)
        └── Task 12 (Settings Page)

Task 10 (Wire Together) depends on Tasks 4, 5, 7, 8, 9
```

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Scaffold SvelteKit project | -- |
| 2 | Type definitions | 1 |
| 3 | Database layer (Dexie) | 2 |
| 4 | Svelte stores | 3 |
| 5 | LLM client + parser | 2 |
| 6 | Two-pane layout shell | 1 |
| 7 | Editor pane components | 2, 6 |
| 8 | File management sidebar | 2, 6 |
| 9 | D3 visualization renderers | 2 |
| 10 | Wire main page together | 4, 5, 7, 8, 9 |
| 11 | Export (PDF + Markdown) | 2, 9 |
| 12 | Settings page | 4, 6 |
