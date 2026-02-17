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

  // Suppress unused variable warning
  void totalSim;

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
