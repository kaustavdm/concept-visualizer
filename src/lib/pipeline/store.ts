import { writable } from 'svelte/store';
import type { PipelineState, PipelineStage, PipelineRecommendation } from './types';
import type { VisualizationType } from '$lib/types';

const INITIAL_STATE: PipelineState = {
  stage: 'idle',
  recommendation: null,
  scores: null,
  error: null
};

function createPipelineStore() {
  const { subscribe, set, update } = writable<PipelineState>(INITIAL_STATE);

  return {
    subscribe,

    setStage(stage: PipelineStage) {
      update(s => ({ ...s, stage, error: null }));
    },

    setRecommendation(rec: PipelineRecommendation) {
      update(s => ({ ...s, recommendation: rec }));
    },

    setScores(scores: Record<VisualizationType, number>) {
      update(s => ({ ...s, scores }));
    },

    setError(error: string) {
      update(s => ({ ...s, stage: 'error' as PipelineStage, error }));
    },

    reset() {
      set({ ...INITIAL_STATE });
    }
  };
}

export const pipelineStore = createPipelineStore();
