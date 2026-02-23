import { describe, it, expect, vi } from 'vitest';
import { createTier2, cosineSimilarity, kMeansClusters } from './tier2-refine';
import type { VisualizationSchema } from '$lib/types';
import type { TierContext } from './types';

function makeCtx(text: string = 'test'): TierContext {
  return {
    text,
    signal: new AbortController().signal,
    onStage: () => {},
  };
}

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });
  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });
  it('handles zero vectors gracefully', () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });
});

describe('kMeansClusters', () => {
  it('groups similar vectors into same cluster', () => {
    const vectors = [
      [1, 0, 0], [0.9, 0.1, 0],   // cluster A
      [0, 1, 0], [0.1, 0.9, 0],   // cluster B
    ];
    const assignments = kMeansClusters(vectors, 2);
    expect(assignments[0]).toBe(assignments[1]); // same cluster
    expect(assignments[2]).toBe(assignments[3]); // same cluster
    expect(assignments[0]).not.toBe(assignments[2]); // different clusters
  });

  it('returns single cluster for k=1', () => {
    const assignments = kMeansClusters([[1, 0], [0, 1]], 1);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[0]).toBe(0);
  });

  it('handles single vector', () => {
    const assignments = kMeansClusters([[1, 0, 0]], 2);
    expect(assignments).toHaveLength(1);
  });
});

describe('createTier2', () => {
  it('adds theme from clustering to nodes', async () => {
    // Mock USE model: 3 nodes, first 2 similar, third different
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([
        [1, 0, 0],      // node A
        [0.9, 0.1, 0],  // node B (similar to A)
        [0, 1, 0],      // node C (different)
      ]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'Node A', weight: 0.5 },
        { id: 'b', label: 'Node B', weight: 0.3 },
        { id: 'c', label: 'Node C', weight: 0.8 },
      ],
      edges: [
        { source: 'a', target: 'b', strength: 0.5 },
      ],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, makeCtx());

    // All nodes should have a theme
    expect(result.nodes.every(n => typeof n.theme === 'string')).toBe(true);
    // Nodes A and B should share a theme (similar embeddings)
    const themeA = result.nodes.find(n => n.id === 'a')!.theme;
    const themeB = result.nodes.find(n => n.id === 'b')!.theme;
    expect(themeA).toBe(themeB);
  });

  it('adds similarity-based edges', async () => {
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([
        [1, 0, 0],      // A
        [0.8, 0.6, 0],  // B (similar to A, sim ~0.8)
        [0, 0, 1],      // C (different from A and B)
      ]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, makeCtx());
    // Should have edge between A and B (high similarity)
    const abEdge = result.edges.find(
      e => (e.source === 'a' && e.target === 'b') || (e.source === 'b' && e.target === 'a')
    );
    expect(abEdge).toBeDefined();
  });

  it('refines existing edge strengths', async () => {
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([
        [1, 0], [0.9, 0.1],
      ]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A', weight: 0.5 },
        { id: 'b', label: 'B', weight: 0.5 },
      ],
      edges: [
        { source: 'a', target: 'b', strength: 0.3 },
      ],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, makeCtx());
    // Edge strength should be refined (blended with similarity)
    const edge = result.edges.find(e => e.source === 'a' && e.target === 'b');
    expect(edge).toBeDefined();
    expect(edge!.strength).toBeGreaterThan(0);
    expect(edge!.strength).toBeLessThanOrEqual(1);
  });

  it('calls onStage with tier2-embedding and tier2-clustering', async () => {
    const stages: string[] = [];
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([[1, 0], [0, 1]]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    };

    await tier2(schema, { ...makeCtx(), onStage: (s) => stages.push(s) });
    expect(stages).toContain('tier2-embedding');
    expect(stages).toContain('tier2-clustering');
  });

  it('passes through schema unchanged if no nodes', async () => {
    const tier2 = createTier2(() => Promise.resolve({ embed: vi.fn() }));
    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Empty',
      description: '',
      nodes: [],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    };
    const result = await tier2(schema, makeCtx());
    expect(result.nodes).toHaveLength(0);
  });

  it('drops edges with blended strength below 0.2', async () => {
    // Create embeddings where A and B are very dissimilar
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([
        [1, 0, 0],   // A
        [0, 1, 0],   // B — orthogonal to A, similarity = 0
      ]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A', weight: 0.5 },
        { id: 'b', label: 'B', weight: 0.5 },
      ],
      edges: [
        // Weak edge + zero similarity → blended below 0.2
        { source: 'a', target: 'b', strength: 0.1 },
      ],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, makeCtx());
    // Edge should be dropped: 0.5 * 0.1 + 0.5 * 0 = 0.05 < 0.2
    const edge = result.edges.find(
      e => (e.source === 'a' && e.target === 'b') || (e.source === 'b' && e.target === 'a')
    );
    expect(edge).toBeUndefined();
  });

  it('blends weight with degree centrality', async () => {
    // Three nodes: A connected to B and C, B only to A, C only to A
    // A should have higher degree centrality
    const mockEmbed = vi.fn().mockResolvedValue({
      array: () => Promise.resolve([
        [1, 0, 0],      // A
        [0.8, 0.6, 0],  // B — similar to A (sim > 0.5)
        [0.7, 0, 0.7],  // C — somewhat similar to A (sim ~0.7)
      ]),
      dispose: () => {},
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A', weight: 0.5 },
        { id: 'b', label: 'B', weight: 0.5 },
        { id: 'c', label: 'C', weight: 0.5 },
      ],
      edges: [
        { source: 'a', target: 'b', strength: 0.6 },
        { source: 'a', target: 'c', strength: 0.6 },
      ],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, makeCtx());

    const nodeA = result.nodes.find(n => n.id === 'a')!;
    const nodeB = result.nodes.find(n => n.id === 'b')!;
    // A has higher degree, so its blended weight should be >= B's
    expect(nodeA.weight).toBeGreaterThanOrEqual(nodeB.weight!);
  });

  it('returns schema unchanged when signal is aborted after embedding', async () => {
    const controller = new AbortController();

    const mockEmbed = vi.fn().mockImplementation(async () => {
      // Abort during embedding
      controller.abort();
      return {
        array: () => Promise.resolve([[1, 0], [0, 1]]),
        dispose: () => {},
      };
    });

    const tier2 = createTier2(() => Promise.resolve({ embed: mockEmbed }));

    const schema: VisualizationSchema = {
      type: 'graph',
      title: 'Test',
      description: '',
      nodes: [
        { id: 'a', label: 'A', weight: 0.5 },
        { id: 'b', label: 'B', weight: 0.3 },
      ],
      edges: [{ source: 'a', target: 'b', strength: 0.5 }],
      metadata: { concepts: [], relationships: [] },
    };

    const result = await tier2(schema, {
      text: 'test',
      signal: controller.signal,
      onStage: () => {},
    });

    // Should return input schema unchanged
    expect(result).toBe(schema);
  });
});
