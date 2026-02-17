export type VisualizationType = 'graph' | 'tree' | 'flowchart' | 'hierarchy';

export interface VisualizationNode {
  id: string;
  label: string;
  type?: string;
  group?: string;
  details?: string;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface VisualizationSchema {
  type: VisualizationType;
  title: string;
  description: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata: {
    concepts: string[];
    relationships: string[];
  };
}

export interface ConceptFile {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  text: string;
  visualization: VisualizationSchema | null;
  settings: {
    autoSend: boolean;
    vizType?: VisualizationType;
  };
}

export interface AppSettings {
  id: string;           // singleton key, always 'app-settings'
  llmEndpoint: string;
  llmModel: string;
  theme: 'light' | 'dark';
  controlPlacement: 'hud' | 'dock' | 'embedded';
  extractionEngine: 'llm' | 'nlp' | 'keywords' | 'semantic';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  llmEndpoint: 'http://localhost:11434/v1',
  llmModel: 'llama3.2',
  theme: 'light',
  controlPlacement: 'hud',
  extractionEngine: 'llm'
};
