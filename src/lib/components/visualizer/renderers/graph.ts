import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function groupColor(group: string | undefined, groups: string[]): string {
  if (!group) return COLORS[0];
  const idx = groups.indexOf(group);
  return COLORS[idx % COLORS.length];
}

export function renderGraph(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');

  const groups = [...new Set(schema.nodes.map(n => n.group).filter(Boolean))] as string[];

  const nodes = schema.nodes.map(n => ({ ...n }));
  const edges = schema.edges.map(e => ({ source: e.source, target: e.target, label: e.label }));

  const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40));

  const g = svg.append('g');

  // Zoom
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Edges
  const link = g.append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', 1.5);

  // Edge labels
  const edgeLabels = g.append('g')
    .selectAll('text')
    .data(edges)
    .join('text')
    .text(d => d.label || '')
    .attr('font-size', '10px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle');

  // Nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 20)
    .style('fill', d => groupColor(d.group, groups))
    .style('stroke', 'var(--viz-node-stroke)')
    .attr('stroke-width', 2)
    .call(drag(simulation) as any);

  // Node labels
  const labels = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.label)
    .attr('font-size', '12px')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', 35);

  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    edgeLabels
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y);
  });
}

function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
  return d3.drag()
    .on('start', (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on('drag', (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });
}
