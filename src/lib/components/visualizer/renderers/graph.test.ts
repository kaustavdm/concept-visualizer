import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderGraph } from './graph';
import type { VisualizationSchema } from '$lib/types';

function makeSvg() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  svg.setAttribute('width', '800');
  svg.setAttribute('height', '600');
  dom.window.document.body.appendChild(svg);
  return svg;
}

const baseSchema: VisualizationSchema = {
  type: 'graph',
  title: 'Test Graph',
  description: 'A test',
  nodes: [
    { id: 'a', label: 'Node A', weight: 1.0, theme: 'process', narrativeRole: 'central' },
    { id: 'b', label: 'Node B', weight: 0.5, theme: 'process', narrativeRole: 'supporting' },
    { id: 'c', label: 'Node C', weight: 0.0, theme: 'context', narrativeRole: 'contextual' },
  ],
  edges: [
    { source: 'a', target: 'b', label: 'connects', strength: 0.8 },
    { source: 'b', target: 'c', label: 'leads to', strength: 0.3 },
  ],
  metadata: { concepts: ['Node A', 'Node B', 'Node C'], relationships: [] }
};

describe('renderGraph', () => {
  let svg: SVGSVGElement;

  beforeEach(() => { svg = makeSvg(); });

  it('renders 3 nodes (circles) and 0 straight lines', () => {
    renderGraph(svg, baseSchema);
    const circles = svg.querySelectorAll('circle:not(.glow)');
    const lines = svg.querySelectorAll('line');
    expect(circles.length).toBe(3);
    expect(lines.length).toBe(0);
  });

  it('renders curved path edges instead of lines', () => {
    renderGraph(svg, baseSchema);
    const paths = svg.querySelectorAll('path.edge');
    expect(paths.length).toBe(2);
  });

  it('renders node labels', () => {
    renderGraph(svg, baseSchema);
    const texts = Array.from(svg.querySelectorAll('text')).map(t => t.textContent);
    expect(texts).toContain('Node A');
    expect(texts).toContain('Node B');
  });

  it('renders variable-size circles based on node weight', () => {
    renderGraph(svg, baseSchema);
    const circles = Array.from(svg.querySelectorAll('circle:not(.glow)'));
    const radii = circles.map(c => parseFloat(c.getAttribute('r') ?? '0'));
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });

  it('renders a glow ring for central-role nodes', () => {
    renderGraph(svg, baseSchema);
    const glowCircles = svg.querySelectorAll('circle.glow');
    expect(glowCircles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders with legacy schema (no new fields) without throwing', () => {
    const legacySchema: VisualizationSchema = {
      type: 'graph',
      title: 'Legacy',
      description: '',
      nodes: [
        { id: 'x', label: 'X', theme: 'g1' },
        { id: 'y', label: 'Y' },
      ],
      edges: [{ source: 'x', target: 'y' }],
      metadata: { concepts: [], relationships: [] }
    };
    expect(() => renderGraph(svg, legacySchema)).not.toThrow();
  });
});
