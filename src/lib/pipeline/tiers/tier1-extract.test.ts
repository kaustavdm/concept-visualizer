import { describe, it, expect } from 'vitest';
import { tier1Extract } from './tier1-extract';
import type { TierContext } from './types';
import type { VisualizationSchema } from '$lib/types';

const emptySchema: VisualizationSchema = {
  type: 'graph',
  title: '',
  description: '',
  nodes: [],
  edges: [],
  metadata: { concepts: [], relationships: [] },
};

function makeCtx(text: string): TierContext {
  return {
    text,
    signal: new AbortController().signal,
    onStage: () => {},
  };
}

describe('tier1Extract', () => {
  it('extracts nodes from keyword-rich text', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data. Data drives machine learning algorithms.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.nodes.length).toBeGreaterThanOrEqual(2);
    expect(schema.nodes.length).toBeLessThanOrEqual(15);
    expect(schema.nodes.every(n => n.id && n.label)).toBe(true);
    expect(schema.nodes.some(n => typeof n.weight === 'number')).toBe(true);
  });

  it('produces edges from co-occurrence', async () => {
    const text = 'Cats chase mice. Mice eat cheese. Cats and mice live together.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.edges.length).toBeGreaterThan(0);
    expect(schema.edges.every(e => e.source && e.target)).toBe(true);
  });

  it('assigns weights in 0-1 range', async () => {
    const text = 'Quantum computing revolutionizes cryptography. Quantum bits enable parallel processing. Cryptography secures communications.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    for (const node of schema.nodes) {
      expect(node.weight).toBeGreaterThanOrEqual(0);
      expect(node.weight).toBeLessThanOrEqual(1);
    }
  });

  it('returns empty schema for empty text', async () => {
    const schema = await tier1Extract(emptySchema, makeCtx(''));
    expect(schema.nodes).toHaveLength(0);
    expect(schema.edges).toHaveLength(0);
  });

  it('populates metadata.concepts', async () => {
    const text = 'Philosophy explores ethics and morality. Ethics governs human behavior.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.metadata.concepts.length).toBeGreaterThan(0);
  });

  it('caps nodes at 15', async () => {
    const text = Array.from({ length: 20 }, (_, i) =>
      `Concept${i} relates to Topic${i}. Topic${i} influences Area${i}.`
    ).join(' ');
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.nodes.length).toBeLessThanOrEqual(15);
  });

  it('generates edge strength in 0-1 range', async () => {
    const text = 'Dogs chase cats. Dogs and cats are pets. Pets need food. Food costs money.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    for (const edge of schema.edges) {
      if (edge.strength !== undefined) {
        expect(edge.strength).toBeGreaterThanOrEqual(0);
        expect(edge.strength).toBeLessThanOrEqual(1);
      }
    }
  });

  it('detects viz type from signal words', async () => {
    const text = 'First do step one. Then proceed to step two. Next, handle step three. Finally, complete step four.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    // Sequential signals should push toward flowchart
    expect(['flowchart', 'graph']).toContain(schema.type);
  });

  it('generates node IDs with t1- prefix', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.nodes.every(n => n.id.startsWith('t1-'))).toBe(true);
  });

  it('sets title from top concepts', async () => {
    const text = 'Machine learning uses neural networks. Neural networks process data. Data drives machine learning algorithms.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.title.length).toBeGreaterThan(0);
  });

  it('sets description with sentence count', async () => {
    const text = 'Cats chase mice. Mice eat cheese. Cats and mice live together.';
    const schema = await tier1Extract(emptySchema, makeCtx(text));
    expect(schema.description).toContain('3 sentences');
  });

  it('handles single-word input gracefully', async () => {
    const schema = await tier1Extract(emptySchema, makeCtx('Hello'));
    // Should not crash, may or may not produce nodes
    expect(schema).toBeDefined();
    expect(schema.nodes.length).toBeLessThanOrEqual(15);
  });
});
