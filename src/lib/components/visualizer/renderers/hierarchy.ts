import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

export function renderHierarchy(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
  const margin = { top: 20, right: 120, bottom: 20, left: 120 };

  // Build hierarchy (horizontal tree layout)
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
    height - margin.top - margin.bottom,
    width - margin.left - margin.right
  ]);
  treeLayout(root as any);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
  );

  // Links (horizontal)
  g.selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', d3.linkHorizontal()
      .x((d: any) => d.y)
      .y((d: any) => d.x) as any)
    .attr('fill', 'none')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1.5);

  // Nodes
  const nodeG = g.selectAll('g.node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

  nodeG.append('circle')
    .attr('r', 6)
    .attr('fill', (d: any) => d.children ? '#3b82f6' : '#10b981');

  nodeG.append('text')
    .text((d: any) => d.data.label)
    .attr('font-size', '12px')
    .attr('fill', '#1f2937')
    .attr('dx', (d: any) => d.children ? -12 : 12)
    .attr('dy', 4)
    .attr('text-anchor', (d: any) => d.children ? 'end' : 'start');
}
