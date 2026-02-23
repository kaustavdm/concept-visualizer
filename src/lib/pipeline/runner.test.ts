import { describe, it, expect } from 'vitest';
import { createTieredRunner } from './runner';
import type { VisualizationSchema } from '$lib/types';
import type { TierFn } from './tiers/types';

const emptySchema: VisualizationSchema = {
  type: 'graph',
  title: '',
  description: '',
  nodes: [],
  edges: [],
  metadata: { concepts: [], relationships: [] },
};

const mockSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test',
  description: 'Test',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  metadata: { concepts: ['A'], relationships: [] },
};

describe('createTieredRunner', () => {
  it('yields results for each enabled tier', async () => {
    const tier1: TierFn = async () => mockSchema;
    const tier2: TierFn = async (s) => ({ ...s, title: 'Refined' });

    const runner = createTieredRunner({ tier1, tier2, tier3: null });
    const results: number[] = [];

    for await (const result of runner.run('test text')) {
      results.push(result.tier);
    }

    expect(results).toEqual([1, 2]);
  });

  it('runs all 3 tiers when all provided', async () => {
    const tier1: TierFn = async () => mockSchema;
    const tier2: TierFn = async (s) => ({ ...s, title: 'T2' });
    const tier3: TierFn = async (s) => ({ ...s, title: 'T3' });

    const runner = createTieredRunner({ tier1, tier2, tier3 });
    const results: number[] = [];

    for await (const result of runner.run('test')) {
      results.push(result.tier);
    }

    expect(results).toEqual([1, 2, 3]);
  });

  it('runs only tier 1 when others are null', async () => {
    const tier1: TierFn = async () => mockSchema;

    const runner = createTieredRunner({ tier1, tier2: null, tier3: null });
    const results: number[] = [];

    for await (const result of runner.run('test')) {
      results.push(result.tier);
    }

    expect(results).toEqual([1]);
  });

  it('stops on abort between tiers', async () => {
    const tier1: TierFn = async () => mockSchema;
    const tier2: TierFn = async (s) => {
      await new Promise((r) => setTimeout(r, 100));
      return s;
    };

    const runner = createTieredRunner({ tier1, tier2, tier3: null });
    const results: number[] = [];

    for await (const result of runner.run('test')) {
      results.push(result.tier);
      if (result.tier === 1) runner.abort();
    }

    expect(results).toEqual([1]);
  });

  it('calls onStage callback with stage progression', async () => {
    const stages: string[] = [];
    const tier1: TierFn = async () => mockSchema;

    const runner = createTieredRunner({ tier1, tier2: null, tier3: null });

    for await (const _ of runner.run('test', (stage) => stages.push(stage))) {
      // consume
    }

    expect(stages).toContain('tier1-extracting');
    expect(stages).toContain('tier1-complete');
    expect(stages).toContain('complete');
  });

  it('each yield includes the schema', async () => {
    const tier1: TierFn = async () => mockSchema;

    const runner = createTieredRunner({ tier1, tier2: null, tier3: null });

    for await (const result of runner.run('test')) {
      expect(result.schema).toBe(mockSchema);
      expect(result.schema.nodes).toHaveLength(1);
    }
  });
});
