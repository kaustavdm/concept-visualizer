import type { VisualizationSchema } from '$lib/types';
import type { PipelineStage } from '../types';

export interface TierContext {
  text: string;
  signal: AbortSignal;
  onStage: (stage: PipelineStage) => void;
}

export type TierFn = (
  schema: VisualizationSchema,
  ctx: TierContext,
) => Promise<VisualizationSchema>;

export interface TierResult {
  tier: number;
  schema: VisualizationSchema;
}
