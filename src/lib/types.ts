export type VisualizationType =
  | 'graph' | 'tree' | 'flowchart' | 'hierarchy'
  | 'logicalflow' | 'storyboard';

export type NarrativeRole = 'central' | 'supporting' | 'contextual' | 'outcome';

export type LogicalRole = 'premise' | 'inference' | 'conclusion' | 'evidence' | 'objection';

export type StoryRole = 'scene' | 'event' | 'conflict' | 'resolution';

export interface VisualizationNode {
  id: string;
  label: string;
  details?: string;
  weight?: number;
  theme?: string;
  narrativeRole?: NarrativeRole;
  logicalRole?: LogicalRole;
  storyRole?: StoryRole;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
  strength?: number;
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
  renderOptions?: {
    orientation?: 'horizontal' | 'vertical';
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
  cachedSchemas?: Partial<Record<VisualizationType, {
    schema: VisualizationSchema;
    contentHash: string;
  }>>;
}

export interface AppSettings {
  id: string;
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
