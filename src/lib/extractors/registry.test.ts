import { describe, it, expect, vi } from 'vitest';

// Mock the TF.js extractor to avoid loading TensorFlow in tests
vi.mock('./semantic', () => ({
  TFJSExtractor: class {
    id = 'semantic';
    name = 'Semantic (TF.js)';
    async extract() {
      return {
        type: 'graph', title: 'Mock', description: 'Mock',
        nodes: [], edges: [], metadata: { concepts: [], relationships: [] }
      };
    }
  }
}));

vi.mock('$lib/llm/client', () => ({
  generateVisualization: vi.fn().mockResolvedValue({
    type: 'graph', title: 'Mock', description: 'Mock',
    nodes: [], edges: [], metadata: { concepts: [], relationships: [] }
  })
}));

import { createExtractorRegistry } from './registry';

describe('ExtractorRegistry', () => {
  it('should have all four engines', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    const engines = registry.listEngines();

    expect(engines).toHaveLength(4);
    expect(engines.map(e => e.id)).toEqual(['llm', 'nlp', 'keywords', 'semantic']);
  });

  it('should get engine by id', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });

    expect(registry.getEngine('llm').id).toBe('llm');
    expect(registry.getEngine('nlp').id).toBe('nlp');
    expect(registry.getEngine('keywords').id).toBe('keywords');
    expect(registry.getEngine('semantic').id).toBe('semantic');
  });

  it('should throw for unknown engine id', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });

    expect(() => registry.getEngine('unknown' as any)).toThrow('Unknown extraction engine');
  });

  it('should update LLM config', () => {
    const registry = createExtractorRegistry({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    registry.updateLLMConfig({ endpoint: 'http://new:5000/v1', model: 'new-model' });

    // Should not throw
    expect(registry.getEngine('llm').id).toBe('llm');
  });
});
