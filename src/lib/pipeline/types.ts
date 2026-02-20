import type { VisualizationType } from '$lib/types';

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'refining'
  | 'extracting'
  | 'rendering'
  | 'complete'
  | 'error';

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
