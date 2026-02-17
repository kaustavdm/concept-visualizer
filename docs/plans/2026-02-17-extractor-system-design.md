# Unified Extractor System Design

**Date:** 2026-02-17

## Purpose

Replace the single LLM-only extraction path with a unified extractor interface that supports four engines: LLM, NLP parsing (compromise.js), keyword extraction (RAKE), and semantic analysis (TF.js + Universal Sentence Encoder). All engines produce the same VisualizationSchema output. The user switches engines via settings or a gamepad key combo.

## Interface

```typescript
interface ConceptExtractor {
  id: string;                    // 'llm' | 'nlp' | 'keywords' | 'semantic'
  name: string;                  // Display name for UI
  extract(text: string, config?: Record<string, unknown>): Promise<VisualizationSchema>;
}
```

Every engine implements this single method. The app calls `engines[activeEngine].extract(text)` regardless of which engine is selected.

## Engine Registry

```typescript
const engines: Record<string, ConceptExtractor> = {
  llm: new LLMExtractor(config),
  nlp: new CompromiseExtractor(),
  keywords: new RAKEExtractor(),
  semantic: new TFJSExtractor()
};
```

The active engine is determined by `AppSettings.extractionEngine`.

## Engines

### LLM Extractor

Wraps the existing `src/lib/llm/client.ts`. Passes text to the configured OpenAI-compatible endpoint. LLM decides the visualization type, nodes, edges, and metadata. Requires a running LLM server.

- Package: none (existing code)
- Size: 0 (remote call)
- Speed: 2-10s depending on model
- Quality: Best overall
- Viz type: LLM chooses based on content

### NLP Extractor (compromise.js)

Parses English text into grammatical structures. Extracts nouns/noun phrases as nodes, verbs connecting subjects to objects as labeled edges. Groups by sentence or paragraph.

Viz type heuristic:
- Many cross-sentence connections with no clear root = graph
- Sequential action verbs (then, next, after) = flowchart
- Containment phrases (consists of, includes, contains) = hierarchy
- Clear parent-child or "is a" relationships = tree

- Package: `compromise` (~250KB)
- Speed: <100ms
- Quality: Good for structured English text
- Limitation: English only, struggles with complex/ambiguous sentences

### Keywords Extractor (RAKE)

Zero-dependency keyword extraction using a RAKE-like algorithm (Rapid Automatic Keyword Extraction). Tokenizes text, removes stopwords, scores phrases by frequency and co-occurrence. Builds edges from co-occurrence within sentences.

- Package: none (custom ~200 lines)
- Speed: <10ms
- Quality: Basic -- no relationship labels, just co-occurrence
- Viz type: Always graph (no semantic signals for other types)
- Advantage: Language-agnostic, zero dependencies

### Semantic Extractor (TF.js + USE)

Loads Google's Universal Sentence Encoder in the browser. Encodes sentences as 512-dimensional vectors. Extracts noun phrases as candidate nodes. Builds edges from cosine similarity between sentences containing each node. Uses k-means clustering for groups.

Viz type heuristic:
- Tight clusters with clear center = hierarchy
- Linear similarity chain = flowchart
- Distributed connections = graph

- Package: `@tensorflow/tfjs`, `@tensorflow-models/universal-sentence-encoder`
- Size: ~30MB model download (cached after first load)
- Speed: 2-5s inference
- Quality: Good semantic understanding
- Limitation: Requires WebGL, large initial download

## Engine Selection

### Settings Page

A dropdown in the settings page: "Extraction Engine" with options LLM, NLP (compromise), Keywords (RAKE), Semantic (TF.js). Persisted in AppSettings.

### Fast Switch (Gamepad Combo)

Shift+Tab cycles through extraction engines. The center indicator on the action cluster briefly shows the engine name/icon.

### No Auto-Fallback

If the selected engine fails, the error displays normally. No automatic fallback to a different engine. Keeps behavior predictable and explicit.

## Settings Change

```typescript
interface AppSettings {
  id: string;
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
  controlPlacement: 'hud' | 'dock' | 'embedded';
  extractionEngine: 'llm' | 'nlp' | 'keywords' | 'semantic';
}
```

Default: `'llm'` (preserves existing behavior).

## File Structure

```
src/lib/extractors/
  types.ts          -- ConceptExtractor interface
  registry.ts       -- Engine registry and active engine lookup
  llm.ts            -- LLM extractor (wraps existing client.ts)
  nlp.ts            -- compromise.js extractor
  keywords.ts       -- RAKE keyword extractor
  semantic.ts       -- TF.js + USE extractor
```

The existing `src/lib/llm/` directory stays as-is. The LLM extractor in `src/lib/extractors/llm.ts` delegates to it.
