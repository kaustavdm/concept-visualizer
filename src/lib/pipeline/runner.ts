import type { VisualizationSchema } from '$lib/types';
import type { TierFn, TierResult, TierContext } from './tiers/types';
import type { PipelineStage } from './types';

interface TieredRunnerConfig {
  tier1: TierFn;
  tier2: TierFn | null;
  tier3: TierFn | null;
}

export interface TieredRunner {
  run(
    text: string,
    onStage?: (stage: PipelineStage) => void,
  ): AsyncGenerator<TierResult>;
  abort(): void;
}

export function createTieredRunner(config: TieredRunnerConfig): TieredRunner {
  let abortController: AbortController | null = null;

  return {
    async *run(text, onStage = () => {}) {
      abortController?.abort();
      abortController = new AbortController();
      const signal = abortController.signal;

      const ctx: TierContext = { text, signal, onStage };

      const emptySchema: VisualizationSchema = {
        type: 'graph',
        title: '',
        description: '',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] },
      };

      // Tier 1 — always runs
      onStage('tier1-extracting');
      const s1 = await config.tier1(emptySchema, ctx);
      if (signal.aborted) return;
      onStage('tier1-complete');
      yield { tier: 1, schema: s1 };

      // Tier 2 — skip if not available or aborted
      if (config.tier2 && !signal.aborted) {
        onStage('tier2-embedding');
        const s2 = await config.tier2(s1, ctx);
        if (signal.aborted) return;
        onStage('tier2-complete');
        yield { tier: 2, schema: s2 };

        // Tier 3 — skip if not available or aborted
        if (config.tier3 && !signal.aborted) {
          onStage('tier3-enriching');
          const s3 = await config.tier3(s2, ctx);
          if (signal.aborted) return;
          onStage('tier3-complete');
          yield { tier: 3, schema: s3 };
        }
      }

      if (!signal.aborted) onStage('complete');
    },

    abort() {
      abortController?.abort();
      abortController = null;
    },
  };
}
