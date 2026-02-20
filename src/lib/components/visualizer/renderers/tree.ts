import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import {
  themeColor, nodeRadius, hexToRgba, truncate,
  parseSvgDimensions, setupD3Zoom, CARD_W, CARD_H, appendDetailCard
} from './utils';

export function renderTree(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width, height } = parseSvgDimensions(svgEl);
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };

  const nodeMap = new Map(schema.nodes.map(n => [n.id, { ...n, children: [] as any[] }]));
  const childIds = new Set(schema.edges.map(e => e.target));
  const rootId = schema.nodes.find(n => !childIds.has(n.id))?.id || schema.nodes[0]?.id;

  for (const edge of schema.edges) {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) parent.children.push(child);
  }

  const rootData = nodeMap.get(rootId);
  if (!rootData) return;

  const root = d3.hierarchy(rootData);
  const innerWidth = width - margin.left - margin.right;
  const treeLayout = d3.tree().size([innerWidth, height - margin.top - margin.bottom]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  setupD3Zoom(svg, g);

  // Links — smooth S-curve bezier paths
  g.selectAll('path.link')
    .data(root.links())
    .join('path')
    .attr('class', 'link edge-line')
    .attr('d', d3.linkVertical<any, any>()
      .x((d: any) => d.x)
      .y((d: any) => d.y) as any)
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5)
    .style('opacity', 0.55);

  // Node groups
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

  nodeG.append('circle')
    .attr('class', 'node-shape')
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .attr('class', 'node-label')
    .text((d: any) => d.data.label)
    .attr('font-size', (d: any) => d.depth === 0 ? '13px' : '11px')
    .attr('font-weight', (d: any) => d.depth === 0 ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => nodeRadius(d.data.weight) + 14);

  // Detail cards — glass rect attached horizontally, flip side based on x position
  nodeG.filter((d: any) => (d.data.weight ?? 0.5) >= 0.65 && !!d.data.details)
    .each(function(d: any) {
      const group = d3.select(this).append('g').attr('class', 'detail-card');
      const r = nodeRadius(d.data.weight);
      const GAP = 12;
      // Place card to right for left-half nodes, left for right-half nodes
      const goRight = (d.x ?? 0) <= innerWidth / 2;
      const connX1 = goRight ? r : -r;
      const connX2 = goRight ? r + GAP : -(r + GAP);
      const cardX = goRight ? connX2 : connX2 - CARD_W;
      const cardY = -CARD_H / 2;
      appendDetailCard(group, connX1, 0, connX2, 0, cardX, cardY, truncate(d.data.details, 30));
    });
}
