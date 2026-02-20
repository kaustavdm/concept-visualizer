import type { VisualizationType } from '$lib/types';

/** Signal word lists for each viz type. */
const SEQUENTIAL_SIGNALS = ['first', 'then', 'next', 'after', 'finally', 'subsequently', 'step', 'lastly', 'second', 'third', 'before that', 'followed by'];
const TAXONOMIC_SIGNALS = ['is a', 'is an', 'are a', 'are an', 'type of', 'kind of', 'subclass of', 'subcategory of', 'species of'];
const CONTAINMENT_SIGNALS = ['contains', 'includes', 'consists of', 'comprises', 'is made of', 'is part of', 'composed of', 'divided into'];
const LOGICAL_SIGNALS = ['because', 'therefore', 'however', 'consequently', 'evidence', 'suggests', 'conclude', 'premise', 'thus', 'hence', 'although', 'despite', 'implies'];
const NARRATIVE_SIGNALS = ['scene', 'meanwhile', 'character', 'conflict', 'resolution', 'chapter', 'protagonist', 'dialogue', 'narrator', 'plot', 'story'];

/**
 * Count how many signals from a list appear in the text.
 * Returns the count normalized by the list length (0–1 scale, clamped).
 */
function signalDensity(lower: string, signals: readonly string[]): number {
  let hits = 0;
  for (const s of signals) {
    if (lower.includes(s)) hits++;
  }
  // Normalize: 3+ hits is considered very strong (1.0)
  return Math.min(hits / 3, 1);
}

/**
 * Analyze text and score it against all 6 visualization types.
 * Returns a record mapping each type to a confidence score (0–1).
 * Runs in <5ms for typical text — no external dependencies.
 */
export function analyzeText(text: string): Record<VisualizationType, number> {
  const lower = text.toLowerCase();

  const flowchartScore = signalDensity(lower, SEQUENTIAL_SIGNALS);
  const treeScore = signalDensity(lower, TAXONOMIC_SIGNALS);
  const hierarchyScore = signalDensity(lower, CONTAINMENT_SIGNALS);
  const logicalflowScore = signalDensity(lower, LOGICAL_SIGNALS);
  const storyboardScore = signalDensity(lower, NARRATIVE_SIGNALS);

  // Graph is the "general" fallback — it scores higher when nothing else is dominant
  const maxSpecific = Math.max(flowchartScore, treeScore, hierarchyScore, logicalflowScore, storyboardScore);
  const graphScore = Math.max(0.3, 1 - maxSpecific);

  return {
    graph: graphScore,
    tree: treeScore,
    flowchart: flowchartScore,
    hierarchy: hierarchyScore,
    logicalflow: logicalflowScore,
    storyboard: storyboardScore
  };
}

/** Return the viz type with the highest score from an analysis result. */
export function topRecommendation(scores: Record<VisualizationType, number>): { type: VisualizationType; confidence: number } {
  let best: VisualizationType = 'graph';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores) as [VisualizationType, number][]) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return { type: best, confidence: bestScore };
}
