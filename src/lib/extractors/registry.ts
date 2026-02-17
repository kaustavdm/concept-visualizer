import type { ConceptExtractor, ExtractionEngineId } from './types';
import { LLMExtractor } from './llm';
import { CompromiseExtractor } from './nlp';
import { RAKEExtractor } from './keywords';
import { TFJSExtractor } from './semantic';

interface LLMConfig {
  endpoint: string;
  model: string;
}

interface ExtractorRegistry {
  getEngine(id: ExtractionEngineId): ConceptExtractor;
  listEngines(): ConceptExtractor[];
  updateLLMConfig(config: LLMConfig): void;
}

export function createExtractorRegistry(llmConfig: LLMConfig): ExtractorRegistry {
  const llm = new LLMExtractor(llmConfig);
  const nlpExtractor = new CompromiseExtractor();
  const keywords = new RAKEExtractor();
  const semantic = new TFJSExtractor();

  const engines: Record<ExtractionEngineId, ConceptExtractor> = {
    llm,
    nlp: nlpExtractor,
    keywords,
    semantic
  };

  return {
    getEngine(id: ExtractionEngineId): ConceptExtractor {
      const engine = engines[id];
      if (!engine) throw new Error(`Unknown extraction engine: ${id}`);
      return engine;
    },

    listEngines(): ConceptExtractor[] {
      return Object.values(engines);
    },

    updateLLMConfig(config: LLMConfig) {
      llm.updateConfig(config);
    }
  };
}
