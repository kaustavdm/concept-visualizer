import { describe, it, expect } from 'vitest';
import { parseVisualizationResponse } from './parser';

const VALID_RESPONSE = JSON.stringify({
  type: 'graph',
  title: 'Test',
  description: 'A test visualization',
  nodes: [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' }
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects' }
  ],
  metadata: {
    concepts: ['Node A', 'Node B'],
    relationships: ['Node A connects to Node B']
  }
});

describe('parseVisualizationResponse', () => {
  it('should parse valid JSON response', () => {
    const result = parseVisualizationResponse(VALID_RESPONSE);
    expect(result.type).toBe('graph');
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('should extract JSON from markdown code blocks', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const result = parseVisualizationResponse(wrapped);
    expect(result.type).toBe('graph');
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseVisualizationResponse('not json')).toThrow();
  });

  it('should throw when required fields are missing', () => {
    expect(() => parseVisualizationResponse('{"type":"graph"}')).toThrow();
  });

  it('should throw when edge references invalid node', () => {
    const bad = JSON.stringify({
      type: 'graph',
      title: 'Test',
      description: 'Test',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'nonexistent' }],
      metadata: { concepts: [], relationships: [] }
    });
    expect(() => parseVisualizationResponse(bad)).toThrow();
  });
});
