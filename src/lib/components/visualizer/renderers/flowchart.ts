import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, edgeThickness, edgeOpacity, hexToRgba, truncate } from './utils';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 44;
const GAP_X = 70;
const GAP_Y = 72;

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
  schema.nodes.forEach(n => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: width / 2, y: 60 + row * (NODE_HEIGHT + GAP_Y) });
      row++;
    }
  });

  const g = svg.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'fc-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10).attr('refY', 0)
    .attr('markerWidth', 7).attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .style('fill', 'var(--viz-edge)');

  // Edges — cubic bezier curves with variable thickness
  g.selectAll('path.fc-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'fc-edge')
    .attr('d', d => {
      const s = positions.get(d.source) || { x: 0, y: 0 };
      const t = positions.get(d.target) || { x: 0, y: 0 };
      const my = (s.y + NODE_HEIGHT / 2 + t.y - NODE_HEIGHT / 2) / 2;
      return `M${s.x},${s.y + NODE_HEIGHT / 2} C${s.x},${my} ${t.x},${my} ${t.x},${t.y - NODE_HEIGHT / 2}`;
    })
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'contrasts' ? '6,4' : null)
    .attr('marker-end', 'url(#fc-arrow)');

  // Edge labels (only for strong edges)
  g.selectAll('text.fc-edge-label')
    .data(schema.edges.filter(e => (e.strength ?? 0.5) > 0.5))
    .join('text')
    .attr('class', 'fc-edge-label')
    .text(d => d.label || '')
    .attr('x', d => ((positions.get(d.source)?.x || 0) + (positions.get(d.target)?.x || 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y || 0) + (positions.get(d.target)?.y || 0)) / 2)
    .attr('font-size', '9px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle');

  // Node groups
  const nodeG = g.selectAll('g.node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'node')
    .attr('transform', d => {
      const pos = positions.get(d.id) || { x: 0, y: 0 };
      return `translate(${pos.x - NODE_WIDTH / 2},${pos.y - NODE_HEIGHT / 2})`;
    });

  // Pill-shaped rects
  nodeG.append('rect')
    .attr('width', NODE_WIDTH)
    .attr('height', NODE_HEIGHT)
    .attr('rx', NODE_HEIGHT / 2)
    .attr('ry', NODE_HEIGHT / 2)
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.82))
    .style('stroke', d => themeColor(d.theme, d.group))
    .attr('stroke-width', 1.5);

  // Label
  nodeG.append('text')
    .text(d => d.label)
    .attr('x', NODE_WIDTH / 2)
    .attr('y', NODE_HEIGHT / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '12px')
    .attr('font-weight', d => d.narrativeRole === 'central' ? '600' : '400')
    .style('fill', 'var(--text-primary)');

  // Detail card — glass rect below pill with vertical connector
  const CARD_W = 148, CARD_H = 30;
  nodeG.filter(d => !!d.details && (d.weight ?? 0) >= 0.6)
    .each(function(d) {
      const group = d3.select(this);
      const cardX = (NODE_WIDTH - CARD_W) / 2;
      const cardY = NODE_HEIGHT + 6;

      group.append('line')
        .attr('x1', NODE_WIDTH / 2).attr('y1', NODE_HEIGHT)
        .attr('x2', NODE_WIDTH / 2).attr('y2', cardY)
        .style('stroke', 'var(--glass-border)')
        .attr('stroke-width', 0.75)
        .style('opacity', 0.7)
        .style('pointer-events', 'none');

      group.append('rect')
        .attr('x', cardX).attr('y', cardY)
        .attr('width', CARD_W).attr('height', CARD_H)
        .attr('rx', 5)
        .style('fill', 'var(--glass-bg)')
        .style('stroke', 'var(--glass-border)')
        .attr('stroke-width', 0.75)
        .style('pointer-events', 'none');

      group.append('text')
        .text(truncate(d.details, 30))
        .attr('x', cardX + 7).attr('y', cardY + CARD_H / 2 + 4)
        .attr('font-size', '9px')
        .style('fill', 'var(--text-tertiary)')
        .style('pointer-events', 'none');
    });
}
