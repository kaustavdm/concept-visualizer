import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { RenderingPipeline } from './orchestrator';
import { pipelineStore } from './store';
import type { VisualizationSchema } from '$lib/types';
import type { ExtractionEngineId } from '$lib/extractors/types';

const MOCK_SCHEMA: VisualizationSchema = {
  type: 'graph',
  title: 'Test',
  description: 'Test viz',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  metadata: { concepts: ['A'], relationships: [] }
};

function mockRegistry() {
  const extract = vi.fn().mockResolvedValue(MOCK_SCHEMA);
  return {
    getEngine: vi.fn().mockReturnValue({ id: 'nlp', name: 'NLP', extract }),
    listEngines: vi.fn().mockReturnValue([]),
    updateLLMConfig: vi.fn()
  };
}

function defaultSettings() {
  return {
    id: 'app-settings',
    llmEndpoint: 'http://localhost:11434/v1',
    llmModel: 'llama3.2',
    theme: 'light' as const,
    controlPlacement: 'hud' as const,
    extractionEngine: 'nlp' as const,
    pipelineMode: 'auto' as const,
    llmRefinement: false
  };
}

describe('RenderingPipeline', () => {
  beforeEach(() => {
    pipelineStore.reset();
  });

  it('runs full auto pipeline: analyze → extract → complete', async () => {
    const registry = mockRegistry();
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    const result = await pipeline.run('First do this, then do that, next do another.', 'graph', 'nlp');

    expect(result).toEqual(MOCK_SCHEMA);
    expect(get(pipelineStore).stage).toBe('complete');
    expect(get(pipelineStore).recommendation).not.toBeNull();
    expect(get(pipelineStore).scores).not.toBeNull();
  });

  it('skips analyze/refine in manual mode', async () => {
    const registry = mockRegistry();
    const settings = { ...defaultSettings(), pipelineMode: 'manual' as const };
    const pipeline = new RenderingPipeline(registry, () => settings);

    await pipeline.run('Some text', 'graph', 'nlp');

    // In manual mode, no recommendation is set
    expect(get(pipelineStore).recommendation).toBeNull();
    expect(get(pipelineStore).scores).toBeNull();
    expect(get(pipelineStore).stage).toBe('complete');
  });

  it('calls the correct extraction engine', async () => {
    const registry = mockRegistry();
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    await pipeline.run('text', 'flowchart', 'nlp');

    expect(registry.getEngine).toHaveBeenCalledWith('nlp');
    const engine = registry.getEngine('nlp');
    expect(engine.extract).toHaveBeenCalledWith('text', 'flowchart');
  });

  it('sets error stage when extraction fails', async () => {
    const registry = mockRegistry();
    registry.getEngine = vi.fn().mockReturnValue({
      id: 'nlp', name: 'NLP',
      extract: vi.fn().mockRejectedValue(new Error('Extraction failed'))
    });
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    await expect(pipeline.run('text', 'graph', 'nlp')).rejects.toThrow('Extraction failed');
    expect(get(pipelineStore).stage).toBe('error');
    expect(get(pipelineStore).error).toBe('Extraction failed');
  });

  it('abort cancels a running pipeline', async () => {
    const registry = mockRegistry();
    // Make extract slow so we can abort
    const extract = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(MOCK_SCHEMA), 500)));
    registry.getEngine = vi.fn().mockReturnValue({ id: 'nlp', name: 'NLP', extract });
    const settings = defaultSettings();
    const pipeline = new RenderingPipeline(registry, () => settings);

    const promise = pipeline.run('text', 'graph', 'nlp');
    pipeline.abort();

    await expect(promise).rejects.toThrow('Pipeline aborted');
  });
});
