import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, hexToRgba } from './utils';

export function renderTree(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
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
  const treeLayout = d3.tree().size([
    width - margin.left - margin.right,
    height - margin.top - margin.bottom
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Links — smooth S-curve bezier paths
  g.selectAll('path.link')
    .data(root.links())
    .join('path')
    .attr('class', 'link')
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
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme, d.data.group), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme, d.data.group))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', (d: any) => d.depth === 0 ? '13px' : '11px')
    .attr('font-weight', (d: any) => d.depth === 0 ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => nodeRadius(d.data.weight) + 14);
}
