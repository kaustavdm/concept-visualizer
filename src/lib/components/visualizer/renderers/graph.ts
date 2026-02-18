import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import { themeColor, nodeRadius, edgeThickness, edgeOpacity, hexToRgba, truncate } from './utils';

export function renderGraph(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = parseInt(svgEl.getAttribute('width') || '800');
  const height = parseInt(svgEl.getAttribute('height') || '600');

  const nodes = schema.nodes.map(n => ({ ...n }));
  const edges = schema.edges.map(e => ({ ...e, source: e.source, target: e.target }));

  const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => {
      const sr = nodeRadius((d.source as any).weight);
      const tr = nodeRadius((d.target as any).weight);
      return 80 + sr + tr;
    }))
    .force('charge', d3.forceManyBody().strength((d: any) => -200 - nodeRadius(d.weight) * 8))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => nodeRadius(d.weight) + 10));

  const g = svg.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);
  (svgEl as any).__d3Zoom = zoom;

  // Click SVG background to deselect neighbourhood highlight
  svg.on('click', () => {
    node.style('opacity', 1);
    link.style('opacity', (e: any) => edgeOpacity(e.strength));
    glowRings.style('opacity', 0.25);
  });

  // ── Glow rings (rendered behind nodes; only for central/outcome roles) ──
  const glowRings = g.append('g')
    .selectAll('circle.glow')
    .data(nodes.filter(n => n.narrativeRole === 'central' || n.narrativeRole === 'outcome'))
    .join('circle')
    .attr('class', 'glow')
    .attr('r', (d: any) => nodeRadius(d.weight) + 8)
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.25))
    .style('pointer-events', 'none');

  // ── Edges — curved quadratic bezier paths ──
  const link = g.append('g')
    .selectAll('path.edge')
    .data(edges)
    .join('path')
    .attr('class', 'edge')
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', (d: any) => edgeThickness(d.strength))
    .style('opacity', (d: any) => edgeOpacity(d.strength))
    .attr('stroke-dasharray', (d: any) => d.type === 'contrasts' ? '5,4' : null);

  // ── Edge labels (only for strong edges) ──
  const edgeLabels = g.append('g')
    .selectAll('text.edge-label')
    .data(edges.filter((e: any) => (e.strength ?? 0.5) > 0.5))
    .join('text')
    .attr('class', 'edge-label')
    .text((d: any) => d.label || '')
    .attr('font-size', '9px')
    .style('fill', 'var(--viz-edge-label)')
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none');

  // ── Nodes ──
  const node = g.append('g')
    .selectAll('circle:not(.glow)')
    .data(nodes)
    .join('circle')
    .attr('r', d => nodeRadius(d.weight))
    .style('fill', d => hexToRgba(themeColor(d.theme, d.group), 0.82))
    .style('stroke', d => themeColor(d.theme, d.group))
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .call(drag(simulation) as any)
    .on('click', function (event, d: any) {
      event.stopPropagation();
      const neighborIds = new Set<string>([d.id]);
      edges.forEach((e: any) => {
        if (e.source.id === d.id) neighborIds.add(e.target.id);
        if (e.target.id === d.id) neighborIds.add(e.source.id);
      });
      node.style('opacity', (n: any) => neighborIds.has(n.id) ? 1 : 0.12);
      link.style('opacity', (e: any) =>
        (e.source.id === d.id || e.target.id === d.id)
          ? edgeOpacity(e.strength)
          : 0.04
      );
      glowRings.style('opacity', (n: any) => neighborIds.has(n.id) ? 0.25 : 0.04);
    });

  // ── Node labels ──
  const labels = g.append('g')
    .selectAll('text.label')
    .data(nodes)
    .join('text')
    .attr('class', 'label')
    .text(d => d.label)
    .attr('font-size', (d: any) => nodeRadius(d.weight) >= 22 ? '11px' : '10px')
    .attr('font-weight', (d: any) => d.narrativeRole === 'central' ? '600' : '400')
    .style('fill', 'var(--text-primary)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => nodeRadius(d.weight) >= 22 ? 4 : nodeRadius(d.weight) + 14)
    .style('pointer-events', 'none');

  // ── Detail snippets (visible for prominent nodes) ──
  const detailSnippets = g.append('g')
    .selectAll('text.detail')
    .data(nodes.filter(n => (n.weight ?? 0.5) >= 0.65 && n.details))
    .join('text')
    .attr('class', 'detail')
    .text(d => truncate(d.details, 42))
    .attr('font-size', '9px')
    .style('fill', 'var(--text-tertiary)')
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none');

  function curvePath(d: any): string {
    const sx = d.source.x ?? 0, sy = d.source.y ?? 0;
    const tx = d.target.x ?? 0, ty = d.target.y ?? 0;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = Math.min(dist * 0.22, 55);
    const mx = (sx + tx) / 2 - (dy / dist) * offset;
    const my = (sy + ty) / 2 + (dx / dist) * offset;
    return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
  }

  simulation.on('tick', () => {
    link.attr('d', (d: any) => curvePath(d));

    edgeLabels
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 6);

    glowRings
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y);

    detailSnippets
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y + nodeRadius(d.weight) + 25);
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
