import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { pipelineStore } from './store';

describe('pipelineStore', () => {
  it('starts in idle stage with no recommendation', () => {
    const state = get(pipelineStore);
    expect(state.stage).toBe('idle');
    expect(state.recommendation).toBeNull();
    expect(state.scores).toBeNull();
    expect(state.error).toBeNull();
  });

  it('setStage updates the current stage', () => {
    pipelineStore.setStage('analyzing');
    expect(get(pipelineStore).stage).toBe('analyzing');
  });

  it('setRecommendation stores type and confidence', () => {
    pipelineStore.setRecommendation({ type: 'flowchart', confidence: 0.85 });
    const state = get(pipelineStore);
    expect(state.recommendation?.type).toBe('flowchart');
    expect(state.recommendation?.confidence).toBe(0.85);
  });

  it('setScores stores all viz type scores', () => {
    const scores = {
      graph: 0.3, tree: 0.2, flowchart: 0.85,
      hierarchy: 0.1, logicalflow: 0.15, storyboard: 0.05
    };
    pipelineStore.setScores(scores);
    expect(get(pipelineStore).scores).toEqual(scores);
  });

  it('setError sets stage to error and stores message', () => {
    pipelineStore.setError('Something went wrong');
    const state = get(pipelineStore);
    expect(state.stage).toBe('error');
    expect(state.error).toBe('Something went wrong');
  });

  it('reset returns to idle with no recommendation', () => {
    pipelineStore.setStage('extracting');
    pipelineStore.setRecommendation({ type: 'tree', confidence: 0.7 });
    pipelineStore.reset();
    const state = get(pipelineStore);
    expect(state.stage).toBe('idle');
    expect(state.recommendation).toBeNull();
    expect(state.scores).toBeNull();
    expect(state.error).toBeNull();
  });
});
