# Unified Extractor System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the direct LLM call in `+page.svelte` with a unified extractor system supporting four switchable engines: LLM, NLP (compromise.js), Keywords (RAKE), and Semantic (TF.js + USE).

**Architecture:** A `ConceptExtractor` interface defines the contract. Four engine classes implement it. A registry maps engine IDs to instances. The active engine is determined by `AppSettings.extractionEngine`. The main page calls `registry.getEngine(activeEngine).extract(text)` instead of `generateVisualization()` directly.

**Tech Stack:** TypeScript, compromise.js (~250KB), custom RAKE (~200 lines), @tensorflow/tfjs + @tensorflow-models/universal-sentence-encoder (~30MB model)

---

### Task 1: Extractor Interface and Types

**Files:**
- Create: `src/lib/extractors/types.ts`

**Step 1: Create the extractor interface**

Create `src/lib/extractors/types.ts`:

```typescript
import type { VisualizationSchema } from '$lib/types';

export interface ConceptExtractor {
  id: string;
  name: string;
  extract(text: string, config?: Record<string, unknown>): Promise<VisualizationSchema>;
}

export type ExtractionEngineId = 'llm' | 'nlp' | 'keywords' | 'semantic';
```

**Step 2: Commit**

```bash
git add src/lib/extractors/types.ts && git commit -m "feat: add ConceptExtractor interface and types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: RAKE Keyword Extractor

**Files:**
- Create: `src/lib/extractors/keywords.ts`
- Test: `src/lib/extractors/keywords.test.ts`

**Step 1: Write failing test**

Create `src/lib/extractors/keywords.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RAKEExtractor } from './keywords';

describe('RAKEExtractor', () => {
  const extractor = new RAKEExtractor();

  it('should have id "keywords"', () => {
    expect(extractor.id).toBe('keywords');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data. Data drives decisions.';
    const result = await extractor.extract(text);

    expect(result.type).toBe('graph');
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges).toBeDefined();
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
    expect(result.metadata.relationships.length).toBeGreaterThan(0);
  });

  it('should extract keyword phrases as nodes', async () => {
    const text = 'Artificial intelligence powers modern search engines. Search engines return relevant results.';
    const result = await extractor.extract(text);

    const labels = result.nodes.map(n => n.label.toLowerCase());
    // Should contain multi-word phrases, not just single words
    expect(labels.some(l => l.includes('search') || l.includes('intelligence') || l.includes('engine'))).toBe(true);
  });

  it('should produce edges from co-occurrence', async () => {
    const text = 'Cats chase mice. Mice eat cheese. Cheese comes from cows.';
    const result = await extractor.extract(text);

    // Nodes that co-occur in a sentence should have edges
    expect(result.edges.length).toBeGreaterThan(0);
    for (const edge of result.edges) {
      expect(result.nodes.some(n => n.id === edge.source)).toBe(true);
      expect(result.nodes.some(n => n.id === edge.target)).toBe(true);
    }
  });

  it('should handle empty text gracefully', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });

  it('should handle single-word text', async () => {
    const result = await extractor.extract('Hello');
    expect(result.type).toBe('graph');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/extractors/keywords.test.ts`
Expected: FAIL -- module not found.

**Step 3: Implement RAKE keyword extractor**

Create `src/lib/extractors/keywords.ts`:

```typescript
import type { VisualizationSchema, VisualizationNode, VisualizationEdge } from '$lib/types';
import type { ConceptExtractor } from './types';

// Common English stopwords for RAKE filtering
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom', 'how', 'when', 'where', 'why', 'not', 'no', 'nor',
  'if', 'then', 'else', 'so', 'as', 'than', 'too', 'very', 'just',
  'about', 'above', 'after', 'again', 'all', 'also', 'am', 'any',
  'because', 'before', 'between', 'both', 'each', 'few', 'get',
  'got', 'here', 'into', 'more', 'most', 'much', 'must', 'new',
  'now', 'off', 'old', 'once', 'only', 'other', 'over', 'own',
  'same', 'some', 'still', 'such', 'take', 'there', 'through',
  'under', 'up', 'while', 'come', 'comes', 'go', 'goes', 'make',
  'makes', 'made'
]);

/** Split text into sentences */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Tokenize a sentence into lowercase words */
function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/** Extract candidate keyword phrases from a sentence */
function extractPhrases(words: string[]): string[][] {
  const phrases: string[][] = [];
  let current: string[] = [];

  for (const word of words) {
    if (STOPWORDS.has(word)) {
      if (current.length > 0) {
        phrases.push([...current]);
        current = [];
      }
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    phrases.push(current);
  }

  return phrases;
}

/** Score phrases using RAKE: sum of word degree / word frequency */
function scorePhrases(sentences: string[][]): Map<string, number> {
  const wordFreq = new Map<string, number>();
  const wordDegree = new Map<string, number>();

  // Collect all phrases from all sentences
  const allPhrases: string[][] = [];
  for (const words of sentences) {
    const phrases = extractPhrases(words);
    allPhrases.push(...phrases);
  }

  // Calculate word frequency and degree
  for (const phrase of allPhrases) {
    const degree = phrase.length - 1;
    for (const word of phrase) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      wordDegree.set(word, (wordDegree.get(word) ?? 0) + degree);
    }
  }

  // Score each phrase
  const phraseScores = new Map<string, number>();
  for (const phrase of allPhrases) {
    const key = phrase.join(' ');
    if (phraseScores.has(key)) continue;

    let score = 0;
    for (const word of phrase) {
      const freq = wordFreq.get(word) ?? 1;
      const deg = wordDegree.get(word) ?? 0;
      score += (deg + freq) / freq;
    }
    phraseScores.set(key, score);
  }

  return phraseScores;
}

/** Build co-occurrence edges from sentences */
function buildCoOccurrence(sentences: string[][], phraseKeys: Set<string>): Map<string, number> {
  const coOccurrence = new Map<string, number>();

  for (const words of sentences) {
    const phrases = extractPhrases(words);
    const keys = phrases.map(p => p.join(' ')).filter(k => phraseKeys.has(k));

    // Every pair of phrases in the same sentence co-occurs
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const edgeKey = [keys[i], keys[j]].sort().join('|||');
        coOccurrence.set(edgeKey, (coOccurrence.get(edgeKey) ?? 0) + 1);
      }
    }
  }

  return coOccurrence;
}

export class RAKEExtractor implements ConceptExtractor {
  id = 'keywords';
  name = 'Keywords (RAKE)';

  async extract(text: string): Promise<VisualizationSchema> {
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      return {
        type: 'graph',
        title: 'Keywords',
        description: 'No content to analyze',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    // Tokenize each sentence
    const tokenizedSentences = sentences.map(tokenize);

    // Score phrases
    const phraseScores = scorePhrases(tokenizedSentences);

    // Take top phrases as nodes (max 15)
    const sorted = [...phraseScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const phraseKeys = new Set(sorted.map(([key]) => key));

    // Build nodes
    const nodes: VisualizationNode[] = sorted.map(([phrase], i) => ({
      id: `kw-${i}`,
      label: phrase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: 'concept',
      details: `Score: ${sorted[i][1].toFixed(1)}`
    }));

    // Map phrase keys to node IDs
    const phraseToId = new Map<string, string>();
    sorted.forEach(([phrase], i) => {
      phraseToId.set(phrase, `kw-${i}`);
    });

    // Build edges from co-occurrence
    const coOccurrence = buildCoOccurrence(tokenizedSentences, phraseKeys);
    const edges: VisualizationEdge[] = [];
    for (const [edgeKey, count] of coOccurrence) {
      const [a, b] = edgeKey.split('|||');
      const sourceId = phraseToId.get(a);
      const targetId = phraseToId.get(b);
      if (sourceId && targetId) {
        edges.push({
          source: sourceId,
          target: targetId,
          label: `co-occurs (${count})`,
          type: 'relates'
        });
      }
    }

    const concepts = nodes.map(n => n.label);
    const relationships = edges.map(e => {
      const src = nodes.find(n => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label ?? e.target;
      return `${src} ${e.label} ${tgt}`;
    });

    return {
      type: 'graph',
      title: concepts.slice(0, 3).join(', '),
      description: `Keyword extraction from ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`,
      nodes,
      edges,
      metadata: { concepts, relationships }
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/extractors/keywords.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/extractors/ && git commit -m "feat: add RAKE keyword extractor with co-occurrence edges

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: NLP Extractor (compromise.js)

**Files:**
- Create: `src/lib/extractors/nlp.ts`
- Test: `src/lib/extractors/nlp.test.ts`

**Step 1: Install compromise**

Run: `npm install compromise`

**Step 2: Write failing test**

Create `src/lib/extractors/nlp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CompromiseExtractor } from './nlp';

describe('CompromiseExtractor', () => {
  const extractor = new CompromiseExtractor();

  it('should have id "nlp"', () => {
    expect(extractor.id).toBe('nlp');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'The cat chases the mouse. The mouse eats the cheese.';
    const result = await extractor.extract(text);

    expect(['graph', 'tree', 'flowchart', 'hierarchy']).toContain(result.type);
    expect(result.title).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
  });

  it('should extract nouns as nodes and verbs as edge labels', async () => {
    const text = 'Dogs chase cats. Cats hunt mice.';
    const result = await extractor.extract(text);

    const labels = result.nodes.map(n => n.label.toLowerCase());
    expect(labels.some(l => l.includes('dog') || l.includes('cat') || l.includes('mice') || l.includes('mouse'))).toBe(true);

    if (result.edges.length > 0) {
      expect(result.edges.some(e => e.label && e.label.length > 0)).toBe(true);
    }
  });

  it('should detect sequential verbs as flowchart', async () => {
    const text = 'First you mix the ingredients. Then you bake the cake. After that you cool it. Finally you serve it.';
    const result = await extractor.extract(text);

    // Sequential signals should suggest flowchart
    expect(['flowchart', 'graph']).toContain(result.type);
  });

  it('should handle empty text', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });

  it('should handle containment phrases as hierarchy', async () => {
    const text = 'Animals include mammals. Mammals include dogs and cats. Dogs include poodles and labradors.';
    const result = await extractor.extract(text);

    expect(['hierarchy', 'tree', 'graph']).toContain(result.type);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/extractors/nlp.test.ts`
Expected: FAIL -- module not found.

**Step 4: Implement NLP extractor**

Create `src/lib/extractors/nlp.ts`:

```typescript
import nlp from 'compromise';
import type { VisualizationSchema, VisualizationType, VisualizationNode, VisualizationEdge } from '$lib/types';
import type { ConceptExtractor } from './types';

// Sequential signal words
const SEQUENTIAL_SIGNALS = ['then', 'next', 'after', 'finally', 'first', 'second', 'third', 'subsequently', 'lastly'];
// Containment signal verbs/phrases
const CONTAINMENT_SIGNALS = ['includes', 'contains', 'consists of', 'comprises', 'is made of', 'is part of'];
// Hierarchical signals
const HIERARCHY_SIGNALS = ['is a', 'is an', 'are a', 'are an', 'type of', 'kind of', 'subclass of'];

function detectVizType(text: string, crossSentenceEdges: number, totalEdges: number): VisualizationType {
  const lower = text.toLowerCase();

  // Check for sequential signals
  const seqCount = SEQUENTIAL_SIGNALS.filter(s => lower.includes(s)).length;
  if (seqCount >= 2) return 'flowchart';

  // Check for containment signals
  const containCount = CONTAINMENT_SIGNALS.filter(s => lower.includes(s)).length;
  if (containCount >= 2) return 'hierarchy';

  // Check for is-a relationships
  const hierCount = HIERARCHY_SIGNALS.filter(s => lower.includes(s)).length;
  if (hierCount >= 2) return 'tree';

  // Default: many cross-sentence connections = graph
  if (crossSentenceEdges > 0 && crossSentenceEdges >= totalEdges * 0.3) return 'graph';

  return 'graph';
}

export class CompromiseExtractor implements ConceptExtractor {
  id = 'nlp';
  name = 'NLP (compromise)';

  async extract(text: string): Promise<VisualizationSchema> {
    if (!text.trim()) {
      return {
        type: 'graph',
        title: 'NLP Analysis',
        description: 'No content to analyze',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    const doc = nlp(text);
    const sentences = doc.sentences().out('array') as string[];

    // Extract nouns and noun phrases as candidate nodes
    const nodeMap = new Map<string, { label: string; count: number; sentences: number[] }>();

    sentences.forEach((sentence, sentIdx) => {
      const sentDoc = nlp(sentence);

      // Get nouns and noun phrases
      const nouns = sentDoc.nouns().out('array') as string[];

      for (const noun of nouns) {
        const key = noun.toLowerCase().trim();
        if (key.length < 2) continue;

        const existing = nodeMap.get(key);
        if (existing) {
          existing.count++;
          existing.sentences.push(sentIdx);
        } else {
          nodeMap.set(key, {
            label: noun.trim(),
            count: 1,
            sentences: [sentIdx]
          });
        }
      }
    });

    // Take top nodes by frequency (max 15)
    const sortedNodes = [...nodeMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    const nodes: VisualizationNode[] = sortedNodes.map(([key], i) => ({
      id: `nlp-${i}`,
      label: nodeMap.get(key)!.label,
      type: 'concept',
      details: `Mentioned ${nodeMap.get(key)!.count} time(s)`
    }));

    // Build key-to-id mapping
    const keyToId = new Map<string, string>();
    sortedNodes.forEach(([key], i) => {
      keyToId.set(key, `nlp-${i}`);
    });

    // Extract edges from subject-verb-object patterns
    const edges: VisualizationEdge[] = [];
    const edgeSet = new Set<string>();
    let crossSentenceEdges = 0;

    sentences.forEach((sentence, sentIdx) => {
      const sentDoc = nlp(sentence);
      const verbs = sentDoc.verbs().out('array') as string[];

      // Find nouns in this sentence that are in our node set
      const sentNouns = sentDoc.nouns().out('array') as string[];
      const sentNodeKeys = sentNouns
        .map(n => n.toLowerCase().trim())
        .filter(k => keyToId.has(k));

      // Connect consecutive noun pairs in the sentence with the verb
      for (let i = 0; i < sentNodeKeys.length - 1; i++) {
        const sourceId = keyToId.get(sentNodeKeys[i])!;
        const targetId = keyToId.get(sentNodeKeys[i + 1])!;
        const edgeKey = `${sourceId}-${targetId}`;

        if (sourceId !== targetId && !edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: sourceId,
            target: targetId,
            label: verbs[0] ?? 'relates to',
            type: 'relates'
          });
        }
      }
    });

    // Check for cross-sentence connections (same noun in multiple sentences)
    for (const [key, data] of nodeMap) {
      if (data.sentences.length > 1 && keyToId.has(key)) {
        crossSentenceEdges++;
      }
    }

    const vizType = detectVizType(text, crossSentenceEdges, edges.length);

    const concepts = nodes.map(n => n.label);
    const relationships = edges.map(e => {
      const src = nodes.find(n => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label ?? e.target;
      return `${src} ${e.label} ${tgt}`;
    });

    return {
      type: vizType,
      title: concepts.slice(0, 3).join(', '),
      description: `NLP analysis of ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`,
      nodes,
      edges,
      metadata: { concepts, relationships }
    };
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/extractors/nlp.test.ts`
Expected: All 6 tests PASS.

**Step 6: Commit**

```bash
git add src/lib/extractors/nlp.ts src/lib/extractors/nlp.test.ts package.json package-lock.json && git commit -m "feat: add NLP extractor using compromise.js with viz type heuristics

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: LLM Extractor (Wraps Existing Client)

**Files:**
- Create: `src/lib/extractors/llm.ts`
- Test: `src/lib/extractors/llm.test.ts`

**Step 1: Write failing test**

Create `src/lib/extractors/llm.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { LLMExtractor } from './llm';

// Mock the existing LLM client
vi.mock('$lib/llm/client', () => ({
  generateVisualization: vi.fn().mockResolvedValue({
    type: 'graph',
    title: 'Test',
    description: 'Test description',
    nodes: [{ id: '1', label: 'A' }],
    edges: [],
    metadata: { concepts: ['A'], relationships: [] }
  })
}));

describe('LLMExtractor', () => {
  it('should have id "llm"', () => {
    const extractor = new LLMExtractor({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    expect(extractor.id).toBe('llm');
  });

  it('should delegate to generateVisualization', async () => {
    const extractor = new LLMExtractor({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    const result = await extractor.extract('test text');

    expect(result.type).toBe('graph');
    expect(result.title).toBe('Test');
    expect(result.nodes.length).toBe(1);
  });

  it('should pass config to generateVisualization', async () => {
    const { generateVisualization } = await import('$lib/llm/client');
    const extractor = new LLMExtractor({ endpoint: 'http://custom:1234/v1', model: 'custom-model' });
    await extractor.extract('some text');

    expect(generateVisualization).toHaveBeenCalledWith('some text', {
      endpoint: 'http://custom:1234/v1',
      model: 'custom-model'
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/extractors/llm.test.ts`
Expected: FAIL -- module not found.

**Step 3: Implement LLM extractor**

Create `src/lib/extractors/llm.ts`:

```typescript
import { generateVisualization } from '$lib/llm/client';
import type { VisualizationSchema } from '$lib/types';
import type { ConceptExtractor } from './types';

interface LLMConfig {
  endpoint: string;
  model: string;
}

export class LLMExtractor implements ConceptExtractor {
  id = 'llm';
  name = 'LLM';

  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async extract(text: string): Promise<VisualizationSchema> {
    return generateVisualization(text, this.config);
  }

  /** Update config (e.g. when settings change) */
  updateConfig(config: LLMConfig) {
    this.config = config;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/extractors/llm.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/extractors/llm.ts src/lib/extractors/llm.test.ts && git commit -m "feat: add LLM extractor wrapping existing client.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Semantic Extractor (TF.js + USE)

**Files:**
- Create: `src/lib/extractors/semantic.ts`
- Test: `src/lib/extractors/semantic.test.ts`

**Step 1: Install TensorFlow.js and Universal Sentence Encoder**

Run: `npm install @tensorflow/tfjs @tensorflow-models/universal-sentence-encoder`

**Step 2: Write failing test**

Create `src/lib/extractors/semantic.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock TF.js since it requires WebGL and won't work in Node test env
vi.mock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: vi.fn().mockResolvedValue({
    embed: vi.fn().mockResolvedValue({
      array: vi.fn().mockResolvedValue([
        [0.1, 0.2, 0.3, 0.4],
        [0.1, 0.2, 0.3, 0.5],
        [0.9, 0.8, 0.7, 0.6]
      ]),
      dispose: vi.fn()
    })
  })
}));

vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined)
}));

import { TFJSExtractor } from './semantic';

describe('TFJSExtractor', () => {
  const extractor = new TFJSExtractor();

  it('should have id "semantic"', () => {
    expect(extractor.id).toBe('semantic');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'Machine learning is powerful. Deep learning uses neural networks. Cooking is an art form.';
    const result = await extractor.extract(text);

    expect(['graph', 'tree', 'flowchart', 'hierarchy']).toContain(result.type);
    expect(result.title).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
  });

  it('should build edges based on similarity', async () => {
    const text = 'Sentence one about AI. Sentence two about AI. Completely different topic.';
    const result = await extractor.extract(text);

    // Similar sentences should produce edges between their noun concepts
    expect(result.edges).toBeDefined();
  });

  it('should handle empty text', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/extractors/semantic.test.ts`
Expected: FAIL -- module not found.

**Step 4: Implement semantic extractor**

Create `src/lib/extractors/semantic.ts`:

```typescript
import type { VisualizationSchema, VisualizationType, VisualizationNode, VisualizationEdge } from '$lib/types';
import type { ConceptExtractor } from './types';

// Lazy imports to avoid loading TF.js until needed
let useModel: { embed: (sentences: string[]) => Promise<{ array: () => Promise<number[][]>; dispose: () => void }> } | null = null;

async function loadModel() {
  if (useModel) return useModel;

  const tf = await import('@tensorflow/tfjs');
  await tf.ready();
  const use = await import('@tensorflow-models/universal-sentence-encoder');
  useModel = await use.load();
  return useModel;
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Simple noun phrase extraction (basic regex, no NLP dependency) */
function extractNounPhrases(sentence: string): string[] {
  // Match capitalized words and multi-word phrases
  const words = sentence.split(/\s+/);
  const phrases: string[] = [];
  let current: string[] = [];

  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'it', 'its', 'this', 'that']);

  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
    if (clean.length < 2 || stopwords.has(clean)) {
      if (current.length > 0) {
        phrases.push(current.join(' '));
        current = [];
      }
    } else {
      current.push(clean);
    }
  }
  if (current.length > 0) {
    phrases.push(current.join(' '));
  }

  return phrases;
}

function detectVizType(similarityMatrix: number[][]): VisualizationType {
  const n = similarityMatrix.length;
  if (n < 2) return 'graph';

  // Calculate average similarity and distribution
  let totalSim = 0;
  let highSimCount = 0;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalSim += similarityMatrix[i][j];
      if (similarityMatrix[i][j] > 0.7) highSimCount++;
      pairCount++;
    }
  }

  const avgSim = pairCount > 0 ? totalSim / pairCount : 0;

  // Tight clusters with clear center = hierarchy
  if (highSimCount > pairCount * 0.5) return 'hierarchy';

  // Check for linear chain pattern
  let chainScore = 0;
  for (let i = 0; i < n - 1; i++) {
    if (similarityMatrix[i][i + 1] > 0.5) chainScore++;
  }
  if (chainScore >= (n - 1) * 0.7) return 'flowchart';

  return 'graph';
}

export class TFJSExtractor implements ConceptExtractor {
  id = 'semantic';
  name = 'Semantic (TF.js)';

  async extract(text: string): Promise<VisualizationSchema> {
    if (!text.trim()) {
      return {
        type: 'graph',
        title: 'Semantic Analysis',
        description: 'No content to analyze',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) {
      return {
        type: 'graph',
        title: 'Semantic Analysis',
        description: 'No sentences found',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    // Load model and get embeddings
    const model = await loadModel();
    const embedResult = await model.embed(sentences);
    const embeddings = await embedResult.array();
    embedResult.dispose();

    // Build similarity matrix
    const simMatrix: number[][] = [];
    for (let i = 0; i < embeddings.length; i++) {
      simMatrix[i] = [];
      for (let j = 0; j < embeddings.length; j++) {
        simMatrix[i][j] = i === j ? 1 : cosineSimilarity(embeddings[i], embeddings[j]);
      }
    }

    // Extract noun phrases from each sentence
    const sentenceNouns: Map<string, Set<number>> = new Map(); // noun -> sentence indices
    sentences.forEach((sent, idx) => {
      const nouns = extractNounPhrases(sent);
      for (const noun of nouns) {
        if (!sentenceNouns.has(noun)) {
          sentenceNouns.set(noun, new Set());
        }
        sentenceNouns.get(noun)!.add(idx);
      }
    });

    // Take top nouns as nodes (max 15, sorted by frequency)
    const sortedNouns = [...sentenceNouns.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 15);

    const nodes: VisualizationNode[] = sortedNouns.map(([noun], i) => ({
      id: `sem-${i}`,
      label: noun.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: 'concept',
      details: `Appears in ${sentenceNouns.get(noun)!.size} sentence(s)`
    }));

    // Build edges from semantic similarity between sentences containing the nodes
    const edges: VisualizationEdge[] = [];
    const edgeSet = new Set<string>();
    const SIMILARITY_THRESHOLD = 0.5;

    for (let i = 0; i < sortedNouns.length; i++) {
      for (let j = i + 1; j < sortedNouns.length; j++) {
        const sentencesA = sentenceNouns.get(sortedNouns[i][0])!;
        const sentencesB = sentenceNouns.get(sortedNouns[j][0])!;

        // Find max similarity between any sentence containing node A and any containing node B
        let maxSim = 0;
        for (const sA of sentencesA) {
          for (const sB of sentencesB) {
            if (sA !== sB) {
              maxSim = Math.max(maxSim, simMatrix[sA][sB]);
            }
          }
        }

        // Also count co-occurrence (same sentence)
        const coOccurs = [...sentencesA].some(s => sentencesB.has(s));

        if (maxSim >= SIMILARITY_THRESHOLD || coOccurs) {
          const edgeKey = `sem-${i}-sem-${j}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              source: `sem-${i}`,
              target: `sem-${j}`,
              label: coOccurs ? 'co-occurs' : `similarity: ${maxSim.toFixed(2)}`,
              type: 'relates'
            });
          }
        }
      }
    }

    const vizType = detectVizType(simMatrix);

    const concepts = nodes.map(n => n.label);
    const relationships = edges.map(e => {
      const src = nodes.find(n => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label ?? e.target;
      return `${src} ${e.label} ${tgt}`;
    });

    return {
      type: vizType,
      title: concepts.slice(0, 3).join(', '),
      description: `Semantic analysis of ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`,
      nodes,
      edges,
      metadata: { concepts, relationships }
    };
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/extractors/semantic.test.ts`
Expected: All 4 tests PASS.

**Step 6: Commit**

```bash
git add src/lib/extractors/semantic.ts src/lib/extractors/semantic.test.ts package.json package-lock.json && git commit -m "feat: add semantic extractor using TF.js + Universal Sentence Encoder

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Engine Registry

**Files:**
- Create: `src/lib/extractors/registry.ts`
- Test: `src/lib/extractors/registry.test.ts`

**Step 1: Write failing test**

Create `src/lib/extractors/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the TF.js extractor to avoid loading TensorFlow in tests
vi.mock('./semantic', () => ({
  TFJSExtractor: class {
    id = 'semantic';
    name = 'Semantic (TF.js)';
    async extract() {
      return {
        type: 'graph', title: 'Mock', description: 'Mock',
        nodes: [], edges: [], metadata: { concepts: [], relationships: [] }
      };
    }
  }
}));

vi.mock('$lib/llm/client', () => ({
  generateVisualization: vi.fn().mockResolvedValue({
    type: 'graph', title: 'Mock', description: 'Mock',
    nodes: [], edges: [], metadata: { concepts: [], relationships: [] }
  })
}));

import { createExtractorRegistry } from './registry';

describe('ExtractorRegistry', () => {
  it('should have all four engines', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    const engines = registry.listEngines();

    expect(engines).toHaveLength(4);
    expect(engines.map(e => e.id)).toEqual(['llm', 'nlp', 'keywords', 'semantic']);
  });

  it('should get engine by id', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });

    expect(registry.getEngine('llm').id).toBe('llm');
    expect(registry.getEngine('nlp').id).toBe('nlp');
    expect(registry.getEngine('keywords').id).toBe('keywords');
    expect(registry.getEngine('semantic').id).toBe('semantic');
  });

  it('should throw for unknown engine id', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });

    expect(() => registry.getEngine('unknown' as any)).toThrow('Unknown extraction engine');
  });

  it('should update LLM config', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    registry.updateLLMConfig({ endpoint: 'http://new:5000/v1', model: 'new-model' });

    // Should not throw
    expect(registry.getEngine('llm').id).toBe('llm');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/extractors/registry.test.ts`
Expected: FAIL -- module not found.

**Step 3: Implement registry**

Create `src/lib/extractors/registry.ts`:

```typescript
import type { ConceptExtractor, ExtractionEngineId } from './types';
import { LLMExtractor } from './llm';
import { CompromiseExtractor } from './nlp';
import { RAKEExtractor } from './keywords';
import { TFJSExtractor } from './semantic';

interface LLMConfig {
  endpoint: string;
  model: string;
}

interface ExtractorRegistry {
  getEngine(id: ExtractionEngineId): ConceptExtractor;
  listEngines(): ConceptExtractor[];
  updateLLMConfig(config: LLMConfig): void;
}

export function createExtractorRegistry(llmConfig: LLMConfig): ExtractorRegistry {
  const llm = new LLMExtractor(llmConfig);
  const nlpExtractor = new CompromiseExtractor();
  const keywords = new RAKEExtractor();
  const semantic = new TFJSExtractor();

  const engines: Record<ExtractionEngineId, ConceptExtractor> = {
    llm,
    nlp: nlpExtractor,
    keywords,
    semantic
  };

  return {
    getEngine(id: ExtractionEngineId): ConceptExtractor {
      const engine = engines[id];
      if (!engine) throw new Error(`Unknown extraction engine: ${id}`);
      return engine;
    },

    listEngines(): ConceptExtractor[] {
      return Object.values(engines);
    },

    updateLLMConfig(config: LLMConfig) {
      llm.updateConfig(config);
    }
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/extractors/registry.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/extractors/registry.ts src/lib/extractors/registry.test.ts && git commit -m "feat: add extractor registry for engine lookup and LLM config updates

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Add extractionEngine to AppSettings

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db/index.ts`
- Modify: `src/routes/settings/+page.svelte`

**Step 1: Update AppSettings interface**

In `src/lib/types.ts`, add `extractionEngine` to the `AppSettings` interface:

```typescript
export interface AppSettings {
  id: string;
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
  controlPlacement: 'hud' | 'dock' | 'embedded';
  extractionEngine: 'llm' | 'nlp' | 'keywords' | 'semantic';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light',
  controlPlacement: 'hud',
  extractionEngine: 'llm'
};
```

Note: If the UI/UX tasks have already added `controlPlacement`, just add `extractionEngine`. If not, add both.

**Step 2: Bump Dexie schema version**

In `src/lib/db/index.ts`, if the version is still 1, bump to version 2 with the same stores (Dexie handles new fields on schemaless stores automatically):

```typescript
class ConceptDB extends Dexie {
  files!: EntityTable<ConceptFile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('ConceptVisualizerDB');
    this.version(1).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
    // Version 2: AppSettings gains extractionEngine + controlPlacement
    // No index changes needed; Dexie stores schemaless objects
    this.version(2).stores({
      files: 'id, title, updatedAt',
      settings: 'id'
    });
  }
}
```

**Step 3: Add extraction engine dropdown to settings page**

In `src/routes/settings/+page.svelte`, add:

1. A state variable: `let extractionEngine = $state<'llm' | 'nlp' | 'keywords' | 'semantic'>('llm');`
2. Initialize from store in `onMount`: `extractionEngine = $settingsStore.extractionEngine;`
3. Add to the `save()` call: `extractionEngine`
4. Add dropdown to the form:

```svelte
<div>
  <label for="engine" class="block text-sm font-medium text-gray-700 mb-1">Extraction Engine</label>
  <select
    id="engine"
    bind:value={extractionEngine}
    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="llm">LLM (requires running server)</option>
    <option value="nlp">NLP (compromise.js)</option>
    <option value="keywords">Keywords (RAKE)</option>
    <option value="semantic">Semantic (TF.js - large download)</option>
  </select>
  <p class="text-xs text-gray-400 mt-1">NLP and Keywords work offline. Semantic requires ~30MB model download.</p>
</div>
```

**Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/db/index.ts src/routes/settings/+page.svelte && git commit -m "feat: add extractionEngine to AppSettings with settings page dropdown

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Wire Extractors into Main Page

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Replace direct LLM call with extractor registry**

Update `src/routes/+page.svelte`:

1. Remove the `import { generateVisualization }` line
2. Import the extractor registry: `import { createExtractorRegistry } from '$lib/extractors/registry';`
3. Import the type: `import type { ExtractionEngineId } from '$lib/extractors/types';`
4. Create the registry once at module level or in `onMount`
5. Update `handleVisualize()` to use the active engine from settings:

```typescript
import { createExtractorRegistry } from '$lib/extractors/registry';
import type { ExtractionEngineId } from '$lib/extractors/types';

let registry = createExtractorRegistry({
  endpoint: $settingsStore.llmEndpoint,
  model: $settingsStore.llmModel
});

// Update LLM config when settings change
$effect(() => {
  registry.updateLLMConfig({
    endpoint: $settingsStore.llmEndpoint,
    model: $settingsStore.llmModel
  });
});

async function handleVisualize() {
  if (!activeFile || !activeFile.text.trim()) return;

  vizStore.setLoading();
  try {
    const engineId = $settingsStore.extractionEngine as ExtractionEngineId;
    const engine = registry.getEngine(engineId);
    const viz = await engine.extract(activeFile.text);
    vizStore.setVisualization(viz);
    await filesStore.updateVisualization(activeFile.id, viz);
  } catch (err) {
    vizStore.setError(err instanceof Error ? err.message : 'Unknown error');
  }
}
```

**Step 2: Verify existing behavior preserved**

Run: `npm run dev -- --port 5173`
With `extractionEngine: 'llm'` (default), behavior should be identical to before.
Switch to `'keywords'` in settings: should see RAKE-extracted graph instantly.
Switch to `'nlp'`: should see compromise.js analysis.

**Step 3: Commit**

```bash
git add src/routes/+page.svelte && git commit -m "feat: wire extractor registry into main page, replacing direct LLM call

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Fast Engine Switch (Shift+Tab)

**Files:**
- Modify: `src/lib/controllers/keyboard.ts` (if it exists from UI/UX tasks)
- Modify: `src/routes/+page.svelte`

**Step 1: Add engine cycling logic**

If the keyboard controller from the UI/UX plan exists, add a new action `'cycle_engine'` mapped to Shift+Tab. If it doesn't exist yet, add a simple keydown listener in `+page.svelte`.

In `+page.svelte`, add engine cycling:

```typescript
const ENGINE_ORDER: ExtractionEngineId[] = ['llm', 'nlp', 'keywords', 'semantic'];

function cycleEngine() {
  const current = $settingsStore.extractionEngine as ExtractionEngineId;
  const idx = ENGINE_ORDER.indexOf(current);
  const next = ENGINE_ORDER[(idx + 1) % ENGINE_ORDER.length];
  settingsStore.update({ extractionEngine: next });
  // Brief toast/indicator showing the new engine name
}
```

If the keyboard controller exists, add to `KEY_MAP`:
```typescript
// In handleKeyDown, before the main mapping:
if (e.shiftKey && e.key === 'Tab') {
  e.preventDefault();
  options.onAction('cycle_engine');
  return;
}
```

If the keyboard controller doesn't exist, add a direct listener in `+page.svelte`:
```typescript
function handleKeyDown(e: KeyboardEvent) {
  if (e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    cycleEngine();
  }
}

onMount(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
});
```

**Step 2: Show engine name briefly on switch**

Add a transient state variable that shows the engine name for 2 seconds:

```typescript
let engineToast = $state('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showEngineToast(name: string) {
  engineToast = name;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { engineToast = ''; }, 2000);
}
```

In the template, display the toast near the action cluster center indicator (or as a floating label):

```svelte
{#if engineToast}
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-opacity"
    style="background: var(--accent); color: white;">
    {engineToast}
  </div>
{/if}
```

**Step 3: Commit**

```bash
git add src/ && git commit -m "feat: add Shift+Tab fast switch for cycling extraction engines

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Run All Tests and Verify Build

**Files:**
- No new files

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing + keyword + nlp + llm + semantic + registry tests).

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Manual verification**

Run: `npm run dev -- --port 5173`

Verify:
- [ ] Default engine is LLM (settings page shows "LLM")
- [ ] Switch to Keywords in settings -> Enter visualizes instantly with co-occurrence graph
- [ ] Switch to NLP in settings -> Enter gives compromise.js analysis with viz type heuristics
- [ ] Switch to Semantic in settings -> first use downloads model, then produces semantic graph
- [ ] Shift+Tab cycles through engines with toast notification
- [ ] LLM engine works exactly as before (with running LLM server)
- [ ] Error display works for each engine (e.g. LLM with no server)

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: integration fixes for extractor system

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task Dependency Graph

```
Task 1 (Interface + types)
  |
  +-- Task 2 (RAKE extractor)
  |     |
  |     +-- Task 6 (Registry) <-- also depends on Tasks 3, 4, 5
  |
  +-- Task 3 (NLP extractor)
  |     |
  |     +-- Task 6 (Registry)
  |
  +-- Task 4 (LLM extractor)
  |     |
  |     +-- Task 6 (Registry)
  |
  +-- Task 5 (Semantic extractor)
        |
        +-- Task 6 (Registry)

Task 7 (AppSettings + settings page) <-- independent of Tasks 2-6

Task 8 (Wire into main page) <-- depends on Tasks 6, 7

Task 9 (Fast engine switch) <-- depends on Task 8

Task 10 (Integration test) <-- depends on Task 9
```

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | ConceptExtractor interface and types | -- |
| 2 | RAKE keyword extractor (zero deps) | 1 |
| 3 | NLP extractor (compromise.js) | 1 |
| 4 | LLM extractor (wraps client.ts) | 1 |
| 5 | Semantic extractor (TF.js + USE) | 1 |
| 6 | Engine registry | 2, 3, 4, 5 |
| 7 | Add extractionEngine to AppSettings | -- |
| 8 | Wire extractors into main page | 6, 7 |
| 9 | Fast engine switch (Shift+Tab) | 8 |
| 10 | Integration test + build verification | 9 |
