import type { VisualizationType } from '$lib/types';

export type PipelineStage =
  | 'idle'
  // Tier-specific stages (new tiered pipeline)
  | 'tier1-extracting'
  | 'tier1-complete'
  | 'tier2-embedding'
  | 'tier2-clustering'
  | 'tier2-complete'
  | 'tier3-enriching'
  | 'tier3-complete'
  | 'complete'
  | 'interrupted'
  | 'error'
  // Legacy stages (used by orchestrator until replaced)
  | 'analyzing'
  | 'refining'
  | 'extracting'
  | 'rendering';

export interface VizTypeScore {
  type: VisualizationType;
  score: number;
}

export interface PipelineRecommendation {
  type: VisualizationType;
  confidence: number;
}

export interface PipelineState {
  stage: PipelineStage;
  recommendation: PipelineRecommendation | null;
  scores: Record<VisualizationType, number> | null;
  error: string | null;
}
