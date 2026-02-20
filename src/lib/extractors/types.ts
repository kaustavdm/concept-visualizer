import type { VisualizationSchema, VisualizationType } from '$lib/types';

export interface ConceptExtractor {
  id: string;
  name: string;
  extract(text: string, vizType?: VisualizationType | null): Promise<VisualizationSchema>;
}

export type ExtractionEngineId = 'llm' | 'nlp' | 'keywords' | 'semantic';
