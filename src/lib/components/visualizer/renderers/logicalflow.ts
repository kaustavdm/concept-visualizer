import * as d3 from 'd3';
import type { VisualizationSchema, LogicalRole } from '$lib/types';
import {
  logicalRoleColor, edgeSemanticColor, edgeThickness, edgeOpacity,
  hexToRgba, truncate, parseSvgDimensions, setupD3Zoom,
  CARD_W, appendDetailCard
} from './utils';

const LAYER_MAP: Record<LogicalRole, number> = {
  premise: 0, evidence: 0,
  inference: 1,
  conclusion: 2, objection: 2
};

const NODE_W = 144;
const NODE_H = 40;
const LAYER_GAP_Y = 160;
const COL_GAP_X = 180;

const EDGE_TYPE_KEYS = ['supports', 'contradicts', 'derives', 'qualifies'];

/** Detect dark mode from --canvas-bg CSS custom property */
function detectDark(svgEl: SVGSVGElement): boolean {
  const bg = getComputedStyle(svgEl).getPropertyValue('--canvas-bg').trim();
  return bg.startsWith('#0') || bg.startsWith('rgb(0') || bg.startsWith('rgb(1') || bg.startsWith('rgb(2');
}

/** Hexagon polygon path centred at (cx, cy) */
function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

/** Diamond polygon path centred at (cx, cy) */
function diamondPath(cx: number, cy: number, w: number, h: number): string {
  return `M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy}Z`;
}

export function renderLogicalFlow(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width } = parseSvgDimensions(svgEl);
  const isDark = detectDark(svgEl);

  // ── Topological depth for nodes without logicalRole ──────────────────
  const topoDepth = new Map<string, number>();
  const inDeg = new Map<string, number>(schema.nodes.map(n => [n.id, 0]));
  schema.edges.forEach(e => inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1));

  const queue = schema.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  let depth = 0;
  const seen = new Set<string>();
  while (queue.length > 0) {
    const lvl = queue.splice(0, queue.length);
    lvl.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      topoDepth.set(id, depth);
      schema.edges.filter(e => e.source === id).forEach(e => {
        const d = (inDeg.get(e.target) ?? 1) - 1;
        inDeg.set(e.target, d);
        if (d === 0) queue.push(e.target);
      });
    });
    depth++;
  }
  schema.nodes.filter(n => !seen.has(n.id)).forEach(n => topoDepth.set(n.id, depth));

  // ── Group nodes into 3 layers ────────────────────────────────────────
  const layers: string[][] = [[], [], []];
  schema.nodes.forEach(n => {
    const role = n.logicalRole;
    if (role && LAYER_MAP[role] !== undefined) {
      layers[LAYER_MAP[role]].push(n.id);
    } else {
      const d = Math.min(topoDepth.get(n.id) ?? 0, 2);
      layers[d].push(n.id);
    }
  });

  // ── Compute positions ────────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number }>();
  const topY = 80;
  layers.forEach((ids, layerIdx) => {
    const totalW = ids.length * (NODE_W + COL_GAP_X) - COL_GAP_X;
    const startX = width / 2 - totalW / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: startX + i * (NODE_W + COL_GAP_X) + NODE_W / 2,
        y: topY + layerIdx * LAYER_GAP_Y
      });
    });
  });

  // ── Arrow markers ────────────────────────────────────────────────────
  const defs = svg.append('defs');
  const markerDefs: Array<{ id: string; color: string }> = [
    { id: 'lf-arrow-default', color: 'var(--viz-edge)' },
    { id: 'lf-arrow-supports', color: edgeSemanticColor('supports', isDark) },
    { id: 'lf-arrow-contradicts', color: edgeSemanticColor('contradicts', isDark) },
    { id: 'lf-arrow-derives', color: edgeSemanticColor('derives', isDark) },
    { id: 'lf-arrow-qualifies', color: edgeSemanticColor('qualifies', isDark) },
  ];
  markerDefs.forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .style('fill', color);
  });

  const g = svg.append('g');
  setupD3Zoom(svg, g);

  // ── Edges ────────────────────────────────────────────────────────────
  g.selectAll('path.lf-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'lf-edge')
    .attr('d', d => {
      const s = positions.get(d.source) ?? { x: 0, y: 0 };
      const t = positions.get(d.target) ?? { x: 0, y: 0 };
      const my = (s.y + NODE_H / 2 + t.y - NODE_H / 2) / 2;
      return `M${s.x},${s.y + NODE_H / 2} C${s.x},${my} ${t.x},${my} ${t.x},${t.y - NODE_H / 2}`;
    })
    .style('fill', 'none')
    .style('stroke', d => {
      const tNode = schema.nodes.find(n => n.id === d.target);
      const sNode = schema.nodes.find(n => n.id === d.source);
      if (tNode?.logicalRole === 'objection' || sNode?.logicalRole === 'objection') {
        return edgeSemanticColor('contradicts', isDark);
      }
      return edgeSemanticColor(d.type, isDark);
    })
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'contradicts' ? '6,4' : null)
    .attr('marker-end', d => {
      const tNode = schema.nodes.find(n => n.id === d.target);
      const sNode = schema.nodes.find(n => n.id === d.source);
      if (tNode?.logicalRole === 'objection' || sNode?.logicalRole === 'objection') return 'url(#lf-arrow-contradicts)';
      const key = d.type && EDGE_TYPE_KEYS.includes(d.type) ? d.type : 'default';
      return `url(#lf-arrow-${key})`;
    });

  // ── Edge labels for strong edges ─────────────────────────────────────
  g.selectAll('text.lf-edge-label')
    .data(schema.edges.filter(e => (e.strength ?? 0.5) > 0.6))
    .join('text')
    .attr('class', 'lf-edge-label')
    .text(d => d.label || d.type || '')
    .attr('x', d => ((positions.get(d.source)?.x ?? 0) + (positions.get(d.target)?.x ?? 0)) / 2)
    .attr('y', d => ((positions.get(d.source)?.y ?? 0) + (positions.get(d.target)?.y ?? 0)) / 2 - 6)
    .attr('font-size', '9px')
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--viz-edge-label)')
    .style('pointer-events', 'none');

  // ── Node groups ──────────────────────────────────────────────────────
  const nodeG = g.selectAll('g.lf-node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'lf-node')
    .attr('transform', d => {
      const pos = positions.get(d.id) ?? { x: 0, y: 0 };
      return `translate(${pos.x},${pos.y})`;
    });

  // ── Draw shape per logicalRole ───────────────────────────────────────
  nodeG.each(function(d) {
    const group = d3.select(this);
    const role = d.logicalRole;
    const fill = hexToRgba(logicalRoleColor(role, isDark), 0.85);
    const stroke = logicalRoleColor(role, isDark);
    const r = NODE_H / 2;

    if (role === 'inference') {
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', hexPath(0, 0, r + 4))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'objection') {
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', diamondPath(0, 0, NODE_W * 0.75, NODE_H + 10))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'conclusion') {
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
        .attr('width', NODE_W).attr('height', NODE_H)
        .attr('rx', NODE_H / 2).attr('ry', NODE_H / 2)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'evidence') {
      group.append('circle')
        .attr('class', 'node-shape')
        .attr('r', r - 4)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else {
      // Rounded rect (premise and default)
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -NODE_W / 2).attr('y', -NODE_H / 2)
        .attr('width', NODE_W).attr('height', NODE_H)
        .attr('rx', 6).attr('ry', 6)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    }

    // Label
    group.append('text')
      .text(truncate(d.label, 18))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', d.narrativeRole === 'central' ? '600' : '400')
      .style('fill', 'var(--text-primary)')
      .style('pointer-events', 'none');

    // Detail card for important nodes
    if (d.details && (d.weight ?? 0) >= 0.65) {
      const cardX = -CARD_W / 2;
      const cardY = NODE_H / 2 + 8;
      appendDetailCard(
        group,
        0, NODE_H / 2,
        0, cardY,
        cardX, cardY,
        truncate(d.details, 30)
      );
    }
  });
}
