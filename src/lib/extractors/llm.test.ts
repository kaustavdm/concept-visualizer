import { describe, it, expect, vi } from 'vitest';
import { LLMExtractor } from './llm';

// Mock the existing LLM client
vi.mock('$lib/llm/client', () => ({
  generateVisualization: vi.fn().mockResolvedValue({
    type: 'graph',
    title: 'Test',
    description: 'Test description',
    nodes: [{ id: '1', label: 'A' }],
    edges: [],
    metadata: { concepts: ['A'], relationships: [] }
  })
}));

describe('LLMExtractor', () => {
  it('should have id "llm"', () => {
    const extractor = new LLMExtractor({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    expect(extractor.id).toBe('llm');
  });

  it('should delegate to generateVisualization', async () => {
    const extractor = new LLMExtractor({ endpoint: 'http://localhost:11434/v1', model: 'test' });
    const result = await extractor.extract('test text');

    expect(result.type).toBe('graph');
    expect(result.title).toBe('Test');
    expect(result.nodes.length).toBe(1);
  });

  it('should pass config to generateVisualization', async () => {
    const { generateVisualization } = await import('$lib/llm/client');
    const extractor = new LLMExtractor({ endpoint: 'http://custom:1234/v1', model: 'custom-model' });
    await extractor.extract('some text');

    expect(generateVisualization).toHaveBeenCalledWith('some text', {
      endpoint: 'http://custom:1234/v1',
      model: 'custom-model'
    });
  });
});
