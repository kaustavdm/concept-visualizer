# Multi-Stage Concept Extraction Pipeline with TF.js + LLM

## Summary

Redesign the concept extraction pipeline into three progressive tiers: instant JS extraction (Tier 1), TF.js embedding refinement (Tier 2), and LLM micro-prompt enrichment (Tier 3). Each tier produces a renderable VisualizationSchema. The UI renders after each tier completes, giving instant feedback that progressively improves. This replaces the current single-LLM-call architecture that fails with small (1-8B) local models.

Additionally: 7 observation modes with mode-declared conceptual vocabularies, a prefab system mapping roles to 3D visual templates, tier-granular version history with interrupt/undo, pipeline status in the StatusBar, and text rendering via canvas billboard labels and stone tablet entities.

## Problem Statement

The current extractor sends a complex prompt (5-15 nodes, 6 fields each, edges with 4 fields) to a local LLM in a single call. Small models (1-8B params) collapse to minimal output — typically 2 nodes and 1 edge — regardless of input text. The `RenderingPipeline` orchestrator exists but is bypassed; `vizType` is always null; only the `graph` observation mode is registered.

## Design Decisions

### 1. Three-Tier Progressive Pipeline

Each tier is a pure function: `(schema: VisualizationSchema, ctx: TierContext) => Promise<VisualizationSchema>`. The runner chains them, yielding after each for UI rendering.

```
Text
  ├─ Tier 1: JS Extraction ──────── yields Schema v1 → UI renders immediately
  ├─ Tier 2: TF.js Refinement ──── yields Schema v2 → UI re-renders
  └─ Tier 3: LLM Enrichment ────── yields Schema v3 → UI re-renders
```

#### Tier 1 — JS Extraction (instant, <50ms)

Input: Raw text. Output: Complete renderable schema.

Pipeline:
1. Sentence split (regex)
2. RAKE keyword extraction (from existing `RAKEExtractor` logic)
3. Compromise NLP noun phrases + verb SVO patterns (from existing `CompromiseExtractor`)
4. Merge & deduplicate (fuzzy match, max 15 nodes)
5. TF-IDF weighting → `node.weight` (0-1)
6. Co-occurrence edges (shared sentence → edge, strength = count/max)
7. Verb-based edges (SVO patterns → labeled edges)
8. Signal-word viz type detection (from existing `analyzer.ts`)

Output: 5-15 nodes with `id`, `label`, `weight`. Edges with `source`, `target`, `label`, `strength`. No `theme`, `narrativeRole`, `modeRole`, or `details` yet.

Reuses: guts of `keywords.ts`, `nlp.ts`, `analyzer.ts` refactored into composable functions.

File: `src/lib/pipeline/tiers/tier1-extract.ts`

#### Tier 2 — TF.js Refinement (300-800ms, first run 2-5s for model load)

Input: Schema v1 + original text. Output: Refined schema with clusters, better edges, layout hints.

Pipeline:
1. Load USE model (lazy, cached after first call)
2. Embed sentences → 512-d vectors
3. Embed node labels → 512-d vectors
4. Cosine similarity matrix via TF.js tensor matmul (GPU-accelerated)
5. Refine edges: blend co-occurrence strength with embedding similarity, add missing edges (sim > 0.5), drop weak edges (blended < 0.2)
6. K-means clustering on node embeddings → assign `node.theme` = cluster IDs (k = ceil(sqrt(n/2)), min 2, max 5)
7. Compute centrality: degree centrality blended with TF-IDF weight (0.6 * tfidf + 0.4 * degree)
8. PCA on embeddings → 3D position hints in metadata (falls back to circle layout)
9. Viz type refinement from similarity matrix patterns (override Tier 1 only if confidence > 0.7)

Embedding cache: `Map<string, Float32Array[]>` keyed by message ID. Additive messages only embed new text.

Abort points: after model load, after embedding, after clustering.

File: `src/lib/pipeline/tiers/tier2-refine.ts`

#### Tier 3 — LLM Enrichment (1-3s, depends on model speed)

Input: Schema v2 + original text + active observation mode. Output: Human-quality labels, roles, descriptions.

Micro-prompt design: each prompt is a single-task classification with <100 tokens context and flat JSON response.

Prompts:
1. **Theme naming** (~50 tokens): "These concept clusters were found in text about [title]: Cluster A: [nodes]... Name each in 1-3 words. Reply as JSON."
2. **Mode role classification** (~60 tokens): "Given these concepts: [labels]. [mode.storyFocus] Classify each as one of: [mode.roles]. Reply as JSON."
3. **Edge labeling** (~60 tokens): "These concept pairs are related: A→B, C→D... Label each in 2-4 words. Reply as JSON."
4. **Descriptions** (optional, ~80 tokens): "Write 1-sentence description for each concept. Reply as JSON."
5. **Summary** (optional, ~40 tokens): "Summarize in one sentence: [text excerpt]"

Properties:
- Prompts are independent — can fire in parallel or sequentially with abort checks
- Graceful degradation: if any prompt fails, Tier 2 values stand
- Prompts 4-5 controlled by `settings.llmEnrichmentLevel: 'minimal' | 'full'`
- Total token budget: ~300-500 tokens across all prompts

File: `src/lib/pipeline/tiers/tier3-enrich.ts`

### 2. Pipeline Runner (AsyncGenerator)

```typescript
interface TierContext {
  text: string;
  signal: AbortSignal;
  onStage: (stage: PipelineStage) => void;
  mode?: ObservationMode;  // for Tier 3
}

type TierFn = (schema: VisualizationSchema, ctx: TierContext) => Promise<VisualizationSchema>;

interface TierResult {
  tier: number;
  schema: VisualizationSchema;
  layers: Layer3d[];
}

async function* runTieredPipeline(text, modeId, options): AsyncGenerator<TierResult> {
  const ctx = { text, signal: abortController.signal, onStage, mode };

  const s1 = await tier1Extract(emptySchema(), ctx);
  yield { tier: 1, schema: s1, layers: mode.render(s1, options) };

  const s2 = await tier2Refine(s1, ctx);
  yield { tier: 2, schema: s2, layers: mode.render(s2, options) };

  if (llmAvailable) {
    const s3 = await tier3Enrich(s2, ctx);
    yield { tier: 3, schema: s3, layers: mode.render(s3, options) };
  }
}
```

The observation mode renderer is called after each yield by the page handler, not inside the pipeline.

### 3. Version History with Tier-Granular Snapshots

Each tier completion creates a snapshot:

```
Message "Explain quantum entanglement"
  ├─ Snapshot v5: "Before: Explain quantum..."     ← pre-message (undo target)
  ├─ Tier 1 → Snapshot v6: "Tier 1: keywords"      ← undo to keyword-only
  ├─ Tier 2 → Snapshot v7: "Tier 2: embeddings"    ← undo to TF.js-refined
  └─ Tier 3 → Snapshot v8: "Tier 3: LLM enriched"  ← final state
```

Extended `VersionSnapshot`:

```typescript
interface VersionSnapshot {
  version: number;
  timestamp: string;
  layers: Layer3d[];
  description: string;
  tier?: number;         // 0 = pre-message, 1/2/3 = after that tier
  messageId?: string;    // links snapshot to the chat message
}
```

### 4. Interrupt

Two granularities:
- **Between tiers** (clean): `for await` loop breaks, last rendered tier stays
- **During a tier** (abort): `AbortController.abort()` cancels in-flight work, reverts to last completed tier's snapshot

### 5. Undo

Two levels:
- **Undo entire message**: Restore pre-message snapshot
- **Undo to previous tier**: Restore within-message tier snapshot

Both use existing `files3dStore.restoreSnapshot()`.

### 6. Pipeline Status in StatusBar

New `pipelineStage` prop on StatusBar. Color-coded badge:

| Stage | Label | Color | Animation |
|-------|-------|-------|-----------|
| `idle` | hidden | — | — |
| `tier1-extracting` | EXTRACTING | amber #f59e0b | pulse |
| `tier2-embedding` | EMBEDDING | blue #3b82f6 | pulse |
| `tier2-clustering` | CLUSTERING | blue #3b82f6 | pulse |
| `tier3-enriching` | ENRICHING | purple #8b5cf6 | pulse |
| `complete` | DONE | green #22c55e | static (auto-hide after 2s) |
| `interrupted` | STOPPED | orange #f97316 | static |
| `error` | ERROR | red #ef4444 | static |

Clickable during active stages — click aborts the pipeline.

Updated `PipelineStage` type:

```typescript
type PipelineStage =
  | 'idle'
  | 'tier1-extracting'
  | 'tier1-complete'
  | 'tier2-embedding'
  | 'tier2-clustering'
  | 'tier2-complete'
  | 'tier3-enriching'
  | 'tier3-complete'
  | 'complete'
  | 'interrupted'
  | 'error';
```

### 7. Observation Modes with Declared Conceptual Vocabularies

#### Mode-Declared Roles

Each mode declares its conceptual vocabulary via `ModeRole[]`. The pipeline uses this to classify nodes in Tier 3. Prefabs map roles to 3D visual templates.

```typescript
interface ModeRole {
  id: string;           // 'agent', 'claim', 'surface'
  label: string;        // 'Moral Agent'
  description: string;  // sent to LLM: 'A person or entity making moral choices'
  prefab: string;       // prefab ID: 'morality:agent'
  relevance: 'high' | 'medium' | 'low';
}

interface ObservationMode {
  id: string;
  name: string;
  description: string;
  roles: ModeRole[];
  prefabs: PrefabDefinition[];
  storyFocus: string;   // ~30 words, sent to Tier 3 as classification context
  render(schema: VisualizationSchema, options?: RenderOptions): Layer3d[];
}
```

#### Updated VisualizationNode

```typescript
interface VisualizationNode {
  id: string;
  label: string;
  details?: string;
  weight?: number;
  theme?: string;
  modeRole?: string;              // generic role from active mode's vocabulary
  narrativeRole?: NarrativeRole;  // kept for graph mode backward compat
}
```

#### The 7 Modes

**Mode 1: Graph** (baseline)
- Roles: `core`, `supporting`, `peripheral`, `emergent`
- Spatial: PCA-driven layout, similarity = proximity
- Story focus: "Classify each concept by structural importance: is it a core idea the text revolves around, a supporting detail, background context, or a result/conclusion?"
- Edge types: relates-to, supports, contrasts, exemplifies, depends-on
- Visual: Neutral observatory. Spheres. Gentle bobs. Torus for emergent. Clean white light.

**Mode 2: Morality**
- Roles: `agent`, `affected`, `duty`, `value`, `consequence`, `tension`
- Spatial: Tension-web — tension at center, agents/affected on opposite sides, values radiating
- Story focus: "For each concept, ask: is this someone who acts? Someone affected? A duty or obligation? A moral value? A consequence? A tension between competing demands?"
- Edge types: obliges, harms, benefits, conflicts-with, justifies, bears
- Visual: Caravaggio lighting. Capsules for agents, stone slabs for duties, gold cones for values, torus ripples for consequences. Warm amber light, exp2 fog.

**Mode 3: Ontology**
- Roles: `category`, `instance`, `property`, `process`
- Spatial: Nested containers, tree-depth on Y-axis
- Story focus: "Classify each concept by what it IS: a general category, a specific instance, a property or attribute, or a process/event. Ignore relations; focus on nature."
- Edge types: is-a, has-property, part-of, composed-of, instantiates
- Visual: Natural history museum. Flat box platforms as categories, amber specimen spheres, thin property pillars, spinning process tori. Parchment ground.

**Mode 4: Epistemology**
- Roles: `claim`, `evidence`, `means`, `assumption`, `limit`
- Spatial: Concentric rings (certain=center, uncertain=periphery), size = importance
- Story focus: "Treat each concept as part of knowledge. Is it a claim? Evidence? A means of knowing? An unexamined assumption? A limit on what can be known?"
- Edge types: supports, undermines, overrides, assumes, derives-from, contradicts
- Special: certainty as 0-1 numeric property on nodes, encoded as opacity
- Visual: Sci-fi observatory. No ground — three concentric torus rings. Diamond-oriented boxes for claims. Inverted cones for assumptions. Barrier planes for limits. Deep space backdrop.

**Mode 5: Causality**
- Roles: `cause`, `effect`, `mechanism`, `purpose`, `condition`
- Spatial: Directed flow (upstream→downstream), explicitly allows cycles (rendered as spirals)
- Story focus: "Trace cause and effect. Is this a cause? An effect? A mechanism explaining how? A purpose or goal? A necessary condition?"
- Edge types: produces, enables, prevents, mediates, triggers, co-arises-with
- Visual: River rapids. Cones point downstream. Torus gears for mechanisms. Gate boxes for conditions. Elongated flow floor with arrow markers. Warm upstream, cool downstream.

**Mode 6: Debate**
- Roles: `position`, `counter`, `resolution`, `tension`, `ground`
- Spatial: Opposing poles on a plane, resolutions between (not above), ground as base
- Story focus: "Find opposing views. Is this a position? A counter-position? A resolution? Unresolved tension? Shared ground both sides assume?"
- Edge types: opposes, resolves, subsumes, generates, qualifies, transcends
- Visual: Boxing ring. Blue podiums vs red podiums, mirror symmetry. Purple resolution spheres between. Arena ring. Dramatic overhead light.

**Mode 7: Appearance**
- Roles: `surface`, `depth`, `lens`, `veil`, `marker`
- Spatial: Two-plane parallax — translucent surface above, opaque depth below. Lenses as vertical columns connecting planes. Veils as semi-transparent barriers.
- Story focus: "For each concept: is it a surface appearance, a deeper reality, a lens for seeing deeper, something that obscures understanding, or a clue revealing hidden depth?"
- Edge types: reveals, conceals, distorts, models, contradicts, projects
- Visual: Magician's parlor / X-ray lab. Two literal planes. Parchment facades above, dense indigo spheres below. Clear-blue lens columns. Billowing mauve veil curtains. Gold markers.

#### Mode Switching

When switching modes on existing layers:
1. Read cached `schema` from `ChatMessage.schema` (Tier 2 output)
2. Re-run only Tier 3 with new mode's vocabulary (reclassify nodes)
3. Re-run new mode's renderer (new prefabs, layout, colors)
4. Replace layers matching `source.messageId`

Tiers 1-2 don't re-run — text understanding hasn't changed, only the interpretation lens.

### 8. Prefab System Integration

Prefabs are namespaced per mode: `{modeId}:{roleId}`.

Each mode registers its prefabs at construction. The global `PrefabRegistry` holds all prefabs from all registered modes. The compositor calls `resolvePrefab()` for each entity (existing code path).

Mode renderers assign `prefab: '{modeId}:{roleId}'` on entities based on `node.modeRole`. The prefab template provides shape, material, animation; the entity overrides provide position, scale, label, weight-driven properties.

### 9. Schema Caching for Mode Switching

```typescript
interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  layerIds: string[];
  observationMode?: string;
  schema?: VisualizationSchema;  // cached Tier 2 output
}
```

### 10. Text Rendering

Two text entity types, both driven by a new `TextComponentSpec` on `EntitySpec.components`:

```typescript
interface TextComponentSpec {
  text: string;
  fontSize?: number;       // canvas px, default 48
  color?: [number, number, number];
  background?: [number, number, number];
  backgroundOpacity?: number;
  align?: 'center' | 'left' | 'right';
  billboard?: boolean;     // true = always face camera (default true)
  maxWidth?: number;       // canvas px for word-wrap, default 512
}
```

#### Billboard Labels

Short text (node labels, edge labels) rendered to a canvas, used as emissiveMap on a plane that always faces the camera. Attached as child entities.

- Text on emissive channel → readable in darkness, unaffected by shadows
- Billboard rotation via per-frame `lookAt(camera)` in animate callback
- Visibility: always visible for high-weight nodes (weight > 0.7), distance-threshold fade for others, hover-only for edge labels

#### Stone Tablets

Longer text (mode descriptions, schema summary, node details on select) rendered as texture on 3D geometry (box or plane). Fixed orientation in world space.

- `components.text` + `components.render` coexist → text canvas applied as emissiveMap on the rendered shape
- Text appears as glowing inscriptions on the surface
- Mode-specific tablet styling: gold inscriptions on dark stone (morality), holographic glass (epistemology), parchment placards (ontology), etc.

#### Text Progressive Enhancement

| Tier | Text added |
|------|-----------|
| Tier 1 | Node labels from keywords. Edge labels from verbs. |
| Tier 2 | Cluster theme labels as group annotations. |
| Tier 3 | LLM-enriched labels. Node details. Edge labels enriched. Mode tablet with schema description. |

#### Performance

- ~25 canvas textures × ~4KB = ~100KB VRAM
- One `lookAt(camera)` per visible billboard per frame (~25 vector ops)
- Texture re-creation only on tier completion, not per-frame

### 11. Visual Design Per Mode

Each mode has a distinctive visual identity. Full prefab specs with exact colors, materials, animations in the design agent output. Summary:

| Mode | Dominant Shape | Color Temp | Ground | Signature |
|------|---------------|-----------|--------|-----------|
| Graph | Sphere | Neutral blue | Flat plane | Observatory |
| Morality | Capsule/Cone | Warm amber | Dark walnut + arena | Cathedral |
| Ontology | Box/Sphere | Cool slate | Parchment | Museum |
| Epistemology | Diamond box | Ice blue | Concentric torus rings | Holographic |
| Causality | Cone (directional) | Warm→cool gradient | Elongated flow floor | River rapids |
| Debate | Box (podium) | Red vs blue | Arena ring | Boxing ring |
| Appearance | Plane/Sphere | Mauve/indigo | Two physical planes | X-ray parlor |

Shape semantic grammar across modes:
- Spheres = received/complete entities (effects, instances, evidence, resolutions, depths)
- Boxes/capsules = structural/positional (categories, positions, claims, duties)
- Cones = directional/aspirational (causes, values, markers)
- Torus = process/cycle (mechanisms, means, consequences)

### 12. Existing Code Disposition

| File | Action |
|------|--------|
| `src/lib/pipeline/orchestrator.ts` | Replace with tiered runner |
| `src/lib/pipeline/store.ts` | Update PipelineStage type for tier stages |
| `src/lib/pipeline/analyzer.ts` | Extract into Tier 1 as composable function |
| `src/lib/pipeline/types.ts` | Update stage types |
| `src/lib/extractors/llm.ts` | Replace with Tier 3 micro-prompts |
| `src/lib/extractors/nlp.ts` | Extract logic into Tier 1 |
| `src/lib/extractors/keywords.ts` | Extract logic into Tier 1 |
| `src/lib/extractors/semantic.ts` | Extract embedding logic into Tier 2 |
| `src/lib/extractors/registry.ts` | Remove (tiers replace engine selection) |
| `src/lib/extractors/types.ts` | Remove ExtractionEngineId |
| `src/lib/llm/client.ts` | Refactor for micro-prompts (multiple small calls) |
| `src/lib/llm/prompts.ts` | Replace with tier3 micro-prompt builders |
| `src/lib/llm/parser.ts` | Simplify for flat JSON responses |
| `src/lib/3d/pipeline-bridge.ts` | Update to use tiered runner |
| `src/lib/3d/observation-modes/graph.ts` | Update to use prefabs + modeRole |
| `src/lib/3d/observation-modes/types.ts` | Add ModeRole, storyFocus, roles |
| `src/lib/3d/entity-spec.ts` | Add TextComponentSpec, modeRole on node |
| `src/lib/3d/createScene.ts` | Add buildTextBillboard, buildTexturedEntity |
| `src/lib/3d/compositor.ts` | Handle text component passthrough |
| `src/lib/components/3d/StatusBar.svelte` | Add pipeline stage badge |
| `src/routes/+page.svelte` | Wire tiered runner, progressive rendering |
| `src/lib/types.ts` | Add modeRole to VisualizationNode, update settings |

### 13. New Files

| File | Purpose |
|------|---------|
| `src/lib/pipeline/tiers/types.ts` | TierContext, TierFn, TierResult interfaces |
| `src/lib/pipeline/tiers/tier1-extract.ts` | JS extraction (RAKE + NLP + TF-IDF) |
| `src/lib/pipeline/tiers/tier2-refine.ts` | TF.js refinement (embeddings, clustering, PCA) |
| `src/lib/pipeline/tiers/tier3-enrich.ts` | LLM micro-prompt enrichment |
| `src/lib/pipeline/runner.ts` | AsyncGenerator tiered pipeline runner |
| `src/lib/3d/observation-modes/morality.ts` | Morality mode renderer + prefabs |
| `src/lib/3d/observation-modes/ontology.ts` | Ontology mode renderer + prefabs |
| `src/lib/3d/observation-modes/epistemology.ts` | Epistemology mode renderer + prefabs |
| `src/lib/3d/observation-modes/causality.ts` | Causality mode renderer + prefabs |
| `src/lib/3d/observation-modes/debate.ts` | Debate mode renderer + prefabs |
| `src/lib/3d/observation-modes/appearance.ts` | Appearance mode renderer + prefabs |
| `src/lib/3d/text-renderer.ts` | Canvas-to-texture text rendering utilities |

### 14. Settings Changes

```typescript
interface AppSettings {
  // Remove:
  // extractionEngine: ExtractionEngineId;
  // pipelineMode: 'auto' | 'manual';
  // llmRefinement: boolean;

  // Add:
  tier2Enabled: boolean;          // default true, skip if USE model fails
  tier3Enabled: boolean;          // default true, skip if no LLM configured
  llmEnrichmentLevel: 'minimal' | 'full';  // minimal = prompts 1-3, full = all 5
  defaultObservationMode: string; // default 'graph'
}
```
