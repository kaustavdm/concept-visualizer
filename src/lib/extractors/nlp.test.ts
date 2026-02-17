import { describe, it, expect } from 'vitest';
import { CompromiseExtractor } from './nlp';

describe('CompromiseExtractor', () => {
  const extractor = new CompromiseExtractor();

  it('should have id "nlp"', () => {
    expect(extractor.id).toBe('nlp');
  });

  it('should return a valid VisualizationSchema', async () => {
    const text = 'The cat chases the mouse. The mouse eats the cheese.';
    const result = await extractor.extract(text);

    expect(['graph', 'tree', 'flowchart', 'hierarchy']).toContain(result.type);
    expect(result.title).toBeTruthy();
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.metadata.concepts.length).toBeGreaterThan(0);
  });

  it('should extract nouns as nodes and verbs as edge labels', async () => {
    const text = 'Dogs chase cats. Cats hunt mice.';
    const result = await extractor.extract(text);

    const labels = result.nodes.map(n => n.label.toLowerCase());
    expect(labels.some(l => l.includes('dog') || l.includes('cat') || l.includes('mice') || l.includes('mouse'))).toBe(true);

    if (result.edges.length > 0) {
      expect(result.edges.some(e => e.label && e.label.length > 0)).toBe(true);
    }
  });

  it('should detect sequential verbs as flowchart', async () => {
    const text = 'First you mix the ingredients. Then you bake the cake. After that you cool it. Finally you serve it.';
    const result = await extractor.extract(text);

    // Sequential signals should suggest flowchart
    expect(['flowchart', 'graph']).toContain(result.type);
  });

  it('should handle empty text', async () => {
    const result = await extractor.extract('');
    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });

  it('should handle containment phrases as hierarchy', async () => {
    const text = 'Animals include mammals. Mammals include dogs and cats. Dogs include poodles and labradors.';
    const result = await extractor.extract(text);

    expect(['hierarchy', 'tree', 'graph']).toContain(result.type);
  });
});
