/**
 * Tier 2 — TF.js Refinement (USE embeddings, clustering, edge refinement).
 *
 * Receives Tier 1's schema (nodes with TF-IDF weights, co-occurrence edges)
 * and refines it using Universal Sentence Encoder embeddings:
 * - Cosine similarity matrix between node label embeddings
 * - Edge refinement: blend co-occurrence strength with embedding similarity
 * - K-means clustering on embeddings → node.theme
 * - Degree centrality blended with TF-IDF weight
 *
 * The USE model is injectable for testing via createTier2 factory.
 */
import type { VisualizationSchema } from '$lib/types';
import type { TierFn } from './types';

// ---------------------------------------------------------------------------
// UseModel interface (matches TF.js USE model shape)
// ---------------------------------------------------------------------------

export interface UseModel {
  embed: (sentences: string[]) => Promise<{
    array: () => Promise<number[][]>;
    dispose: () => void;
  }>;
}

// ---------------------------------------------------------------------------
// Global model cache for production USE model
// ---------------------------------------------------------------------------

let cachedModel: UseModel | null = null;

async function loadRealModel(): Promise<UseModel> {
  if (cachedModel) return cachedModel;
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();
  const use = await import('@tensorflow-models/universal-sentence-encoder');
  cachedModel = await use.load();
  return cachedModel!;
}

// ---------------------------------------------------------------------------
// Pure math utilities (exported for unit testing)
// ---------------------------------------------------------------------------

/** Cosine similarity between two vectors. Returns 0 for zero vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * K-means clustering on vectors. Returns array of cluster assignments (indices).
 * Uses Euclidean distance. Initializes centroids from first k vectors.
 */
export function kMeansClusters(
  vectors: number[][],
  k: number,
  maxIter = 20,
): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (k >= n) return vectors.map((_, i) => i);

  const dim = vectors[0].length;

  // Initialize centroids from first k vectors
  const centroids = vectors.slice(0, k).map((v) => [...v]);
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each vector to nearest centroid (Euclidean distance)
    const newAssignments = vectors.map((v) => {
      let bestDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let d = 0; d < dim; d++) {
          const diff = v[d] - centroids[c][d];
          dist += diff * diff;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;

    // Recompute centroids
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[c][d] =
          members.reduce((sum, v) => sum + v[d], 0) / members.length;
      }
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Model warmup (pre-download for onboarding)
// ---------------------------------------------------------------------------

/**
 * Pre-download and initialize the USE model so it's ready when Tier 2 runs.
 * Safe to call multiple times — returns the cached model after first load.
 */
export async function warmupTier2Model(): Promise<void> {
  await loadRealModel();
}

// ---------------------------------------------------------------------------
// Tier 2 factory
// ---------------------------------------------------------------------------

/**
 * Create a Tier 2 refinement function with an injectable model loader.
 * Tests can inject a mock model; production uses the real USE model.
 */
export function createTier2(loadModel?: () => Promise<UseModel>): TierFn {
  const loader = loadModel ?? loadRealModel;

  return async (schema, ctx) => {
    // Nothing to refine if no nodes
    if (schema.nodes.length === 0) return schema;

    // -- Stage: embedding --
    ctx.onStage('tier2-embedding');

    const model = await loader();
    const labels = schema.nodes.map((n) => n.label);
    const embedResult = await model.embed(labels);
    const embeddings = await embedResult.array();
    embedResult.dispose();

    // Check abort after the potentially slow embedding step
    if (ctx.signal.aborted) return schema;

    // -- Build cosine similarity matrix --
    const simMatrix: number[][] = [];
    for (let i = 0; i < embeddings.length; i++) {
      simMatrix[i] = [];
      for (let j = 0; j < embeddings.length; j++) {
        simMatrix[i][j] =
          i === j ? 1 : cosineSimilarity(embeddings[i], embeddings[j]);
      }
    }

    // -- Stage: clustering --
    ctx.onStage('tier2-clustering');

    // K-means: k = ceil(sqrt(n/2)), clamped to [2, 5]
    const k = Math.max(
      2,
      Math.min(5, Math.ceil(Math.sqrt(schema.nodes.length / 2))),
    );
    const clusters = kMeansClusters(embeddings, k);

    // -- Build edge index from existing edges --
    const edgeIndex = new Map<string, number>(); // "source|target" -> refinedEdges index
    const refinedEdges = schema.edges.map((e) => ({ ...e }));

    for (let i = 0; i < refinedEdges.length; i++) {
      const e = refinedEdges[i];
      edgeIndex.set(`${e.source}|${e.target}`, i);
    }

    // -- Refine edges: blend with similarity, add new high-similarity edges --
    for (let i = 0; i < schema.nodes.length; i++) {
      for (let j = i + 1; j < schema.nodes.length; j++) {
        const sim = simMatrix[i][j];
        const srcId = schema.nodes[i].id;
        const tgtId = schema.nodes[j].id;
        const key = `${srcId}|${tgtId}`;
        const reverseKey = `${tgtId}|${srcId}`;

        const existingIdx = edgeIndex.get(key) ?? edgeIndex.get(reverseKey);

        if (existingIdx !== undefined) {
          // Blend existing strength with embedding similarity
          const existing = refinedEdges[existingIdx];
          const oldStrength = existing.strength ?? 0.5;
          existing.strength = 0.5 * oldStrength + 0.5 * Math.max(0, sim);
        } else if (sim > 0.5) {
          // Add new edge where embedding similarity is high
          const newIdx = refinedEdges.length;
          refinedEdges.push({
            source: srcId,
            target: tgtId,
            strength: Math.max(0, sim),
          });
          edgeIndex.set(key, newIdx);
        }
      }
    }

    // -- Drop weak edges (blended strength < 0.2) --
    const strongEdges = refinedEdges.filter(
      (e) => (e.strength ?? 0.5) >= 0.2,
    );

    // -- Degree centrality --
    const degree = new Map<string, number>();
    for (const e of strongEdges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const maxDegree = Math.max(1, ...degree.values());

    // -- Assign themes and blend weights with degree centrality --
    const refinedNodes = schema.nodes.map((node, i) => ({
      ...node,
      theme: `cluster-${clusters[i]}`,
      weight:
        0.6 * (node.weight ?? 0.5) +
        0.4 * ((degree.get(node.id) ?? 0) / maxDegree),
    }));

    return {
      ...schema,
      nodes: refinedNodes,
      edges: strongEdges,
    };
  };
}

// ---------------------------------------------------------------------------
// Default export using real USE model
// ---------------------------------------------------------------------------

export const tier2Refine: TierFn = createTier2();
