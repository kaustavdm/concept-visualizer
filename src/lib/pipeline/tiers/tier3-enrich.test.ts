import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTier3 } from './tier3-enrich';
import type { TierContext } from './types';
import type { VisualizationSchema } from '$lib/types';

function makeCtx(overrides: Partial<TierContext> = {}): TierContext {
  return {
    text: 'test',
    signal: new AbortController().signal,
    onStage: () => {},
    ...overrides,
  };
}

function makeSchema(overrides: Partial<VisualizationSchema> = {}): VisualizationSchema {
  return {
    type: 'graph',
    title: 'Test',
    description: '',
    nodes: [
      { id: 'a', label: 'ML', theme: 'cluster-0', weight: 0.5 },
      { id: 'b', label: 'Stats', theme: 'cluster-1', weight: 0.5 },
    ],
    edges: [{ source: 'a', target: 'b', strength: 0.6 }],
    metadata: { concepts: [], relationships: [] },
    ...overrides,
  };
}

/**
 * Create a mock fetch that returns different JSON for each sequential call.
 * Responses are matched by call order.
 */
function mockFetchSequence(responses: string[]) {
  let callIdx = 0;
  return vi.fn().mockImplementation(() => {
    const content = responses[callIdx++ % responses.length];
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content } }],
        }),
    });
  });
}

let origFetch: typeof globalThis.fetch;

beforeEach(() => {
  origFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe('createTier3', () => {
  it('applies theme names from LLM response', async () => {
    // With 2 nodes (themes + edges), fetch will be called for:
    //  1. themes, 2. edges (no roles since no modeRoles)
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI Concepts', 'cluster-1': 'Data Science' }),
      JSON.stringify({ 'ML→Stats': 'enables analysis' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const result = await tier3(makeSchema(), makeCtx());
    expect(result.nodes[0].theme).toBe('AI Concepts');
    expect(result.nodes[1].theme).toBe('Data Science');
  });

  it('applies edge labels from LLM response', async () => {
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI', 'cluster-1': 'Data' }),
      JSON.stringify({ 'ML→Stats': 'enables analysis' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const result = await tier3(makeSchema(), makeCtx());
    expect(result.edges[0].label).toBe('enables analysis');
  });

  it('applies role classification when modeRoles provided', async () => {
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI', 'cluster-1': 'Data' }),
      JSON.stringify({ ML: 'core', Stats: 'supporting' }),
      JSON.stringify({ 'ML→Stats': 'enables' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
      modeRoles: [
        { id: 'core', label: 'Core', description: 'Central concept', prefab: 'sphere', relevance: 'high' },
        { id: 'supporting', label: 'Supporting', description: 'Supporting concept', prefab: 'box', relevance: 'medium' },
      ],
      storyFocus: 'Analyze by importance',
    });

    const result = await tier3(makeSchema(), makeCtx());
    expect(result.nodes[0].modeRole).toBe('core');
    expect(result.nodes[1].modeRole).toBe('supporting');
  });

  it('adds descriptions when enrichmentLevel is full', async () => {
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI', 'cluster-1': 'Data' }),
      JSON.stringify({ 'ML→Stats': 'enables' }),
      JSON.stringify({ ML: 'Machine learning builds models from data.', Stats: 'Statistics provides mathematical foundations.' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'full',
    });

    const result = await tier3(makeSchema(), makeCtx());
    expect(result.nodes[0].details).toBe('Machine learning builds models from data.');
    expect(result.nodes[1].details).toBe('Statistics provides mathematical foundations.');
  });

  it('gracefully degrades on LLM failure — preserves original schema', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const schema = makeSchema();
    const result = await tier3(schema, makeCtx());
    // Original theme preserved on failure
    expect(result.nodes[0].theme).toBe('cluster-0');
    expect(result.nodes[1].theme).toBe('cluster-1');
    // Edge has no label
    expect(result.edges[0].label).toBeUndefined();
  });

  it('gracefully degrades on invalid JSON response', async () => {
    globalThis.fetch = mockFetchSequence([
      'not valid json at all',
      'also not json',
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const schema = makeSchema();
    const result = await tier3(schema, makeCtx());
    // Original values preserved
    expect(result.nodes[0].theme).toBe('cluster-0');
  });

  it('passes through schema unchanged for empty nodes', async () => {
    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const schema = makeSchema({ nodes: [], edges: [] });
    const result = await tier3(schema, makeCtx());
    expect(result).toBe(schema);
  });

  it('calls onStage with tier3-enriching', async () => {
    const stages: string[] = [];
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    await tier3(
      makeSchema({ nodes: [{ id: 'a', label: 'A', theme: 'cluster-0' }], edges: [] }),
      makeCtx({ onStage: (s) => stages.push(s) }),
    );
    expect(stages).toContain('tier3-enriching');
  });

  it('skips edge prompt when no edges', async () => {
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const schema = makeSchema({
      nodes: [{ id: 'a', label: 'A', theme: 'cluster-0' }],
      edges: [],
    });
    const result = await tier3(schema, makeCtx());
    // Only 1 fetch call (themes only, no edge prompt)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result.nodes[0].theme).toBe('AI');
  });

  it('sends correct URL and request format', async () => {
    globalThis.fetch = mockFetchSequence([
      JSON.stringify({ 'cluster-0': 'AI' }),
    ]);

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1/', model: 'my-model' },
      enrichmentLevel: 'minimal',
    });

    await tier3(
      makeSchema({ nodes: [{ id: 'a', label: 'A', theme: 'cluster-0' }], edges: [] }),
      makeCtx(),
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // Verify request body
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('my-model');
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('tolerates partial failures — some prompts succeed, some fail', async () => {
    let callIdx = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        // Theme prompt succeeds
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      'cluster-0': 'AI Concepts',
                      'cluster-1': 'Data Science',
                    }),
                  },
                },
              ],
            }),
        });
      }
      // Edge prompt fails
      return Promise.reject(new Error('Timeout'));
    });

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const result = await tier3(makeSchema(), makeCtx());
    // Themes applied from successful call
    expect(result.nodes[0].theme).toBe('AI Concepts');
    // Edge label not applied (failed call)
    expect(result.edges[0].label).toBeUndefined();
  });

  it('handles HTTP error status gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const tier3 = createTier3({
      llmConfig: { endpoint: 'http://localhost:11434/v1', model: 'test' },
      enrichmentLevel: 'minimal',
    });

    const schema = makeSchema();
    const result = await tier3(schema, makeCtx());
    // Original values preserved
    expect(result.nodes[0].theme).toBe('cluster-0');
  });
});
