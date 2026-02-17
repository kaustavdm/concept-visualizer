import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

export function renderTree(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const margin = { top: 40, right: 40, bottom: 40, left: 40 };

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
  const treeLayout = d3.tree().size([
    width - margin.left - margin.right,
    height - margin.top - margin.bottom
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Zoom
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Links
  g.selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', d3.linkVertical()
      .x((d: any) => d.x)
      .y((d: any) => d.y) as any)
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

  nodeG.append('circle')
    .attr('r', 18)
    .style('fill', '#3b82f6')
    .style('stroke', 'var(--viz-node-stroke)')
    .attr('stroke-width', 2);

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', '11px')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', 32);
}
