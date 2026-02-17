import { describe, it, expect } from 'vitest';
import { RAKEExtractor } from './keywords';

describe('RAKEExtractor', () => {
  const extractor = new RAKEExtractor();

  it('should have id "keywords"', () => {
    expect(extractor.id).toBe('keywords');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data. Data drives decisions.';
    const result = await extractor.extract(text);

    expect(result.type).toBe('graph');
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges).toBeDefined();
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
    expect(result.metadata.relationships.length).toBeGreaterThan(0);
  });

  it('should extract keyword phrases as nodes', async () => {
    const text = 'Artificial intelligence powers modern search engines. Search engines return relevant results.';
    const result = await extractor.extract(text);

    const labels = result.nodes.map(n => n.label.toLowerCase());
    // Should contain multi-word phrases, not just single words
    expect(labels.some(l => l.includes('search') || l.includes('intelligence') || l.includes('engine'))).toBe(true);
  });

  it('should produce edges from co-occurrence', async () => {
    const text = 'Cats chase mice. Mice eat cheese. Cheese comes from cows.';
    const result = await extractor.extract(text);

    // Nodes that co-occur in a sentence should have edges
    expect(result.edges.length).toBeGreaterThan(0);
    for (const edge of result.edges) {
      expect(result.nodes.some(n => n.id === edge.source)).toBe(true);
      expect(result.nodes.some(n => n.id === edge.target)).toBe(true);
    }
  });

  it('should handle empty text gracefully', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });

  it('should handle single-word text', async () => {
    const result = await extractor.extract('Hello');
    expect(result.type).toBe('graph');
  });
});
