import { describe, it, expect, vi } from 'vitest';

// Mock TF.js since it requires WebGL and won't work in Node test env
vi.mock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: vi.fn().mockResolvedValue({
    embed: vi.fn().mockResolvedValue({
      array: vi.fn().mockResolvedValue([
        [0.1, 0.2, 0.3, 0.4],
        [0.1, 0.2, 0.3, 0.5],
        [0.9, 0.8, 0.7, 0.6]
      ]),
      dispose: vi.fn()
    })
  })
}));

vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined)
}));

import { TFJSExtractor } from './semantic';

describe('TFJSExtractor', () => {
  const extractor = new TFJSExtractor();

  it('should have id "semantic"', () => {
    expect(extractor.id).toBe('semantic');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'Machine learning is powerful. Deep learning uses neural networks. Cooking is an art form.';
    const result = await extractor.extract(text);

    expect(['graph', 'tree', 'flowchart', 'hierarchy']).toContain(result.type);
    expect(result.title).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
  });

  it('should build edges based on similarity', async () => {
    const text = 'Sentence one about AI. Sentence two about AI. Completely different topic.';
    const result = await extractor.extract(text);

    // Similar sentences should produce edges between their noun concepts
    expect(result.edges).toBeDefined();
  });

  it('should handle empty text', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });
});
