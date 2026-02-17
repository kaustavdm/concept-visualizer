import type { VisualizationSchema } from '$lib/types';

export interface ConceptExtractor {
  id: string;
  name: string;
  extract(text: string, config?: Record<string, unknown>): Promise<VisualizationSchema>;
}

export type ExtractionEngineId = 'llm' | 'nlp' | 'keywords' | 'semantic';
