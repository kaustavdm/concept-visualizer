import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 50;
const GAP_X = 60;
const GAP_Y = 80;

export function renderFlowchart(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');

  // Topological sort for positioning
  const positions = new Map<string, { x: number; y: number }>();
  const inDegree = new Map<string, number>();
  schema.nodes.forEach(n => inDegree.set(n.id, 0));
  schema.edges.forEach(e => inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1));

  const queue = schema.nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  let row = 0;
  const visited = new Set<string>();

  while (queue.length > 0) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const col = i - (levelSize - 1) / 2;
      positions.set(nodeId, {
        x: width / 2 + col * (NODE_WIDTH + GAP_X),
        y: 60 + row * (NODE_HEIGHT + GAP_Y)
      });

      schema.edges
        .filter(e => e.source === nodeId)
        .forEach(e => {
          const deg = (inDegree.get(e.target) || 1) - 1;
          inDegree.set(e.target, deg);
          if (deg === 0) queue.push(e.target);
        });
    }
    row++;
  }

  // Place any unvisited nodes
  schema.nodes.forEach(n => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: width / 2, y: 60 + row * (NODE_HEIGHT + GAP_Y) });
      row++;
    }
  });

  const g = svg.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Arrows
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10)
    .attr('refY', 0)
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .style('fill', 'var(--viz-edge)');

  // Edges
  g.selectAll('line')
    .data(schema.edges)
    .join('line')
    .attr('x1', d => positions.get(d.source)?.x || 0)
    .attr('y1', d => (positions.get(d.source)?.y || 0) + NODE_HEIGHT / 2)
    .attr('x2', d => positions.get(d.target)?.x || 0)
    .attr('y2', d => (positions.get(d.target)?.y || 0) - NODE_HEIGHT / 2)
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)');

  // Edge labels
  g.selectAll('text.edge-label')
    .data(schema.edges)
    .join('text')
    .attr('class', 'edge-label')
    .text(d => d.label || '')
    .attr('x', d => ((positions.get(d.source)?.x || 0) + (positions.get(d.target)?.x || 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y || 0) + (positions.get(d.target)?.y || 0)) / 2)
    .attr('font-size', '10px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle');

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => {
      const pos = positions.get(d.id) || { x: 0, y: 0 };
      return `translate(${pos.x - NODE_WIDTH / 2},${pos.y - NODE_HEIGHT / 2})`;
    });

  nodeG.append('rect')
    .attr('width', NODE_WIDTH)
    .attr('height', NODE_HEIGHT)
    .attr('rx', d => d.type === 'decision' ? 0 : 8)
    .style('fill', d => d.type === 'decision' ? 'var(--viz-flowchart-fill-decision)' : 'var(--viz-flowchart-fill)')
    .style('stroke', d => d.type === 'decision' ? 'var(--viz-flowchart-stroke-decision)' : 'var(--viz-flowchart-stroke)')
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .text(d => d.label)
    .attr('x', NODE_WIDTH / 2)
    .attr('y', NODE_HEIGHT / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '12px')
    .style('fill', 'var(--text-primary)');
}
