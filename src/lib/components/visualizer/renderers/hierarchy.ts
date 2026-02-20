import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import {
  themeColor, nodeRadius, hexToRgba, truncate,
  parseSvgDimensions, setupD3Zoom, CARD_W, CARD_H, appendDetailCard
} from './utils';

export function renderHierarchy(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width, height } = parseSvgDimensions(svgEl);
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 90;

  // Build hierarchy from nodes + edges
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
  const treeLayout = d3.tree<any>()
    .size([2 * Math.PI, outerRadius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
  treeLayout(root as any);

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // Radial zoom: keep the centre translate as a fixed prefix.
  setupD3Zoom(svg, g, `translate(${cx},${cy})`);

  // Radial bezier links
  g.selectAll('path.radial-link')
    .data(root.links())
    .join('path')
    .attr('class', 'radial-link edge-line')
    .attr('d', d3.linkRadial<any, any>()
      .angle((d: any) => d.x)
      .radius((d: any) => d.y) as any)
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5)
    .style('opacity', 0.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => {
      const angle = d.x - Math.PI / 2;
      return `translate(${d.y * Math.cos(angle)},${d.y * Math.sin(angle)})`;
    });

  nodeG.append('circle')
    .attr('class', 'node-shape')
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .attr('class', 'node-label')
    .text((d: any) => d.data.label)
    .attr('font-size', (d: any) => d.depth === 0 ? '13px' : '10px')
    .attr('font-weight', (d: any) => d.depth === 0 ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', (d: any) => d.x < Math.PI ? 'start' : 'end')
    .attr('x', (d: any) => {
      const r = nodeRadius(d.data.weight) + 5;
      return d.x < Math.PI ? r : -r;
    })
    .attr('dy', 4);

  // Detail cards — radially outward from node, glass rect with connector
  nodeG.filter((d: any) => d.depth > 0 && (d.data.weight ?? 0.5) >= 0.65 && !!d.data.details)
    .each(function(d: any) {
      const group = d3.select(this).append('g').attr('class', 'detail-card');
      const angle = d.x - Math.PI / 2;
      const r = nodeRadius(d.data.weight);
      const GAP = 12;
      const goRight = Math.cos(angle) >= 0;
      const connX1 = Math.cos(angle) * r;
      const connY1 = Math.sin(angle) * r;
      const connX2 = Math.cos(angle) * (r + GAP);
      const connY2 = Math.sin(angle) * (r + GAP);
      const cardX = goRight ? connX2 : connX2 - CARD_W;
      const cardY = connY2 - CARD_H / 2;
      appendDetailCard(group, connX1, connY1, connX2, connY2, cardX, cardY, truncate(d.data.details, 30));
    });
}
