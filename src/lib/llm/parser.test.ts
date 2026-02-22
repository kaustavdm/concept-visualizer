import { describe, it, expect } from 'vitest';
import { parseVisualizationResponse } from './parser';
import { SYSTEM_PROMPT } from './prompts';

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

  it('accepts logicalflow type', () => {
    const raw = JSON.stringify({
      type: 'logicalflow',
      title: 'Test',
      description: 'Test',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    });
    expect(() => parseVisualizationResponse(raw)).not.toThrow();
  });

  it('accepts storyboard type', () => {
    const raw = JSON.stringify({
      type: 'storyboard',
      title: 'Test',
      description: 'Test',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
      metadata: { concepts: [], relationships: [] },
    });
    expect(() => parseVisualizationResponse(raw)).not.toThrow();
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

describe('SYSTEM_PROMPT', () => {
  it('requests the weight field', () => {
    expect(SYSTEM_PROMPT).toContain('"weight"');
  });

  it('requests the theme field', () => {
    expect(SYSTEM_PROMPT).toContain('"theme"');
  });

  it('requests the narrativeRole field', () => {
    expect(SYSTEM_PROMPT).toContain('"narrativeRole"');
  });

  it('requests the strength field on edges', () => {
    expect(SYSTEM_PROMPT).toContain('"strength"');
  });
});
