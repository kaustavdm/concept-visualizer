import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderGraph } from './graph';
import type { VisualizationSchema } from '$lib/types';

const mockSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test Graph',
  description: 'A test',
  nodes: [
    { id: 'a', label: 'Node A', group: 'g1' },
    { id: 'b', label: 'Node B', group: 'g1' },
    { id: 'c', label: 'Node C', group: 'g2' }
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects' },
    { source: 'b', target: 'c', label: 'leads to' }
  ],
  metadata: {
    concepts: ['Node A', 'Node B', 'Node C'],
    relationships: ['A connects B', 'B leads to C']
  }
};

describe('renderGraph', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    dom.window.document.body.appendChild(svg);
  });

  it('should render nodes and edges into svg', () => {
    renderGraph(svg, mockSchema);
    const circles = svg.querySelectorAll('circle');
    const lines = svg.querySelectorAll('line');
    expect(circles.length).toBe(3);
    expect(lines.length).toBe(2);
  });

  it('should render node labels', () => {
    renderGraph(svg, mockSchema);
    const texts = svg.querySelectorAll('text');
    const labels = Array.from(texts).map(t => t.textContent);
    expect(labels).toContain('Node A');
    expect(labels).toContain('Node B');
  });
});
