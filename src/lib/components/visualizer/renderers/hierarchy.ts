import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, hexToRgba } from './utils';

export function renderHierarchy(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');
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

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', `translate(${cx},${cy}) ${event.transform}`));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Radial bezier links
  g.selectAll('path.radial-link')
    .data(root.links())
    .join('path')
    .attr('class', 'radial-link')
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
    .attr('r', (d: any) => nodeRadius(d.data.weight))
    .style('fill', (d: any) => hexToRgba(themeColor(d.data.theme, d.data.group), 0.82))
    .style('stroke', (d: any) => themeColor(d.data.theme, d.data.group))
    .attr('stroke-width', 1.5);

  nodeG.append('text')
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
}
