import { generateVisualization } from '$lib/llm/client';
import type { VisualizationSchema } from '$lib/types';
import type { ConceptExtractor } from './types';

interface LLMConfig {
  endpoint: string;
  model: string;
}

export class LLMExtractor implements ConceptExtractor {
  id = 'llm';
  name = 'LLM';

  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async extract(text: string): Promise<VisualizationSchema> {
    return generateVisualization(text, this.config);
  }

  /** Update config (e.g. when settings change) */
  updateConfig(config: LLMConfig) {
    this.config = config;
  }
}
