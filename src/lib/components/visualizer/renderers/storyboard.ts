import * as d3 from 'd3';
import type { VisualizationSchema } from '$lib/types';
import {
  themeColorForMode, edgeThickness, edgeOpacity, hexToRgba, truncate,
  parseSvgDimensions, setupD3Zoom
} from './utils';

const SCENE_W = 130;
const SCENE_H = 52;
const LANE_PADDING = 20;
const NODE_GAP = 80;
const LANE_BREADTH = 110;
const LABEL_SIZE = 20;
const CONFLICT_COLORS = { light: '#fecaca', dark: '#ef4444' };
const RESOLUTION_COLORS = { light: '#bbf7d0', dark: '#22c55e' };

function detectDark(svgEl: SVGSVGElement): boolean {
  const bg = getComputedStyle(svgEl).getPropertyValue('--canvas-bg').trim();
  return bg.startsWith('#0') || bg.startsWith('rgb(0') || bg.startsWith('rgb(1') || bg.startsWith('rgb(2');
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

function diamondPath(cx: number, cy: number, w: number, h: number): string {
  return `M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy}Z`;
}

export function renderStoryboard(svgEl: SVGSVGElement, schema: VisualizationSchema): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const { width, height } = parseSvgDimensions(svgEl);
  const isDark = detectDark(svgEl);
  const isVertical = schema.renderOptions?.orientation === 'vertical';

  // ── Lane detection ────────────────────────────────────────────────────
  const laneNames: string[] = [];
  schema.nodes.forEach(n => {
    const lane = n.theme ?? 'Main';
    if (!laneNames.includes(lane)) laneNames.push(lane);
  });
  const laneIndex = new Map(laneNames.map((name, i) => [name, i]));

  // ── Topological order ─────────────────────────────────────────────────
  const inDeg = new Map<string, number>(schema.nodes.map(n => [n.id, 0]));
  schema.edges.forEach(e => inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1));
  const topoOrder: string[] = [];
  const queue = schema.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    topoOrder.push(id);
    schema.edges.filter(e => e.source === id).forEach(e => {
      const d = (inDeg.get(e.target) ?? 1) - 1;
      inDeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    });
  }
  schema.nodes.filter(n => !seen.has(n.id)).forEach(n => topoOrder.push(n.id));

  // Assign column index per lane (position along flow axis)
  const laneColCursor = new Map<number, number>(laneNames.map((_, i) => [i, 0]));
  const nodeCol = new Map<string, number>();
  topoOrder.forEach(id => {
    const node = schema.nodes.find(n => n.id === id)!;
    const lane = laneIndex.get(node.theme ?? 'Main') ?? 0;
    nodeCol.set(id, laneColCursor.get(lane) ?? 0);
    laneColCursor.set(lane, (laneColCursor.get(lane) ?? 0) + 1);
  });

  // ── Positions ─────────────────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number }>();

  if (!isVertical) {
    const originX = LABEL_SIZE + 60;
    schema.nodes.forEach(n => {
      const lane = laneIndex.get(n.theme ?? 'Main') ?? 0;
      const col = nodeCol.get(n.id) ?? 0;
      positions.set(n.id, {
        x: originX + col * (SCENE_W + NODE_GAP) + SCENE_W / 2,
        y: LABEL_SIZE + LANE_PADDING + lane * LANE_BREADTH + LANE_BREADTH / 2
      });
    });
  } else {
    const originY = LABEL_SIZE + 60;
    schema.nodes.forEach(n => {
      const lane = laneIndex.get(n.theme ?? 'Main') ?? 0;
      const col = nodeCol.get(n.id) ?? 0;
      positions.set(n.id, {
        x: LABEL_SIZE + LANE_PADDING + lane * LANE_BREADTH + LANE_BREADTH / 2,
        y: originY + col * (SCENE_H + NODE_GAP) + SCENE_H / 2
      });
    });
  }

  const g = svg.append('g');
  setupD3Zoom(svg, g);

  // ── Lane background strips ────────────────────────────────────────────
  laneNames.forEach((name, i) => {
    const laneColor = themeColorForMode(name, isDark);
    if (!isVertical) {
      const y = LABEL_SIZE + i * LANE_BREADTH;
      g.append('rect')
        .attr('x', 0).attr('y', y)
        .attr('width', width).attr('height', LANE_BREADTH)
        .style('fill', hexToRgba(laneColor, isDark ? 0.06 : 0.04))
        .style('pointer-events', 'none');
      g.append('text')
        .text(name)
        .attr('x', 8)
        .attr('y', y + LANE_BREADTH / 2)
        .attr('dominant-baseline', 'central')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .style('fill', laneColor)
        .style('opacity', 0.8)
        .style('pointer-events', 'none');
    } else {
      const x = LABEL_SIZE + i * LANE_BREADTH;
      g.append('rect')
        .attr('x', x).attr('y', 0)
        .attr('width', LANE_BREADTH).attr('height', height)
        .style('fill', hexToRgba(laneColor, isDark ? 0.06 : 0.04))
        .style('pointer-events', 'none');
      g.append('text')
        .text(name)
        .attr('x', x + LANE_BREADTH / 2)
        .attr('y', 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .style('fill', laneColor)
        .style('opacity', 0.8)
        .style('pointer-events', 'none');
    }
  });

  // ── Arrow marker ──────────────────────────────────────────────────────
  svg.append('defs').append('marker')
    .attr('id', 'sb-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .style('fill', 'var(--viz-edge)');

  // ── Edges ─────────────────────────────────────────────────────────────
  g.selectAll('path.sb-edge')
    .data(schema.edges)
    .join('path')
    .attr('class', 'sb-edge edge-line')
    .attr('d', d => {
      const s = positions.get(d.source) ?? { x: 0, y: 0 };
      const t = positions.get(d.target) ?? { x: 0, y: 0 };
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      return `M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`;
    })
    .style('fill', 'none')
    .style('stroke', 'var(--viz-edge)')
    .attr('stroke-width', d => edgeThickness(d.strength))
    .style('opacity', d => edgeOpacity(d.strength))
    .attr('stroke-dasharray', d => d.type === 'influences' ? '5,4' : null)
    .attr('marker-end', d => d.type !== 'influences' ? 'url(#sb-arrow)' : null);

  // ── Node groups ───────────────────────────────────────────────────────
  const nodeG = g.selectAll('g.sb-node')
    .data(schema.nodes)
    .join('g')
    .attr('class', 'sb-node')
    .attr('transform', d => {
      const pos = positions.get(d.id) ?? { x: 0, y: 0 };
      return `translate(${pos.x},${pos.y})`;
    });

  nodeG.each(function(d) {
    const group = d3.select(this);
    const laneColor = themeColorForMode(d.theme ?? 'Main', isDark);
    const role = d.storyRole;
    let fill: string;
    let stroke: string;

    if (role === 'conflict') {
      fill = hexToRgba(isDark ? CONFLICT_COLORS.dark : CONFLICT_COLORS.light, 0.85);
      stroke = isDark ? CONFLICT_COLORS.dark : CONFLICT_COLORS.light;
    } else if (role === 'resolution') {
      fill = hexToRgba(isDark ? RESOLUTION_COLORS.dark : RESOLUTION_COLORS.light, 0.85);
      stroke = isDark ? RESOLUTION_COLORS.dark : RESOLUTION_COLORS.light;
    } else {
      fill = hexToRgba(laneColor, 0.2);
      stroke = laneColor;
    }

    if (role === 'event') {
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', diamondPath(0, 0, SCENE_W * 0.6, SCENE_H))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'conflict') {
      group.append('path')
        .attr('class', 'node-shape')
        .attr('d', hexPath(0, 0, SCENE_H / 2 + 2))
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else if (role === 'resolution') {
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -SCENE_W / 2).attr('y', -SCENE_H / 2)
        .attr('width', SCENE_W).attr('height', SCENE_H)
        .attr('rx', SCENE_H / 2).attr('ry', SCENE_H / 2)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    } else {
      // Wide rect (scene and default)
      group.append('rect')
        .attr('class', 'node-shape')
        .attr('x', -SCENE_W / 2).attr('y', -SCENE_H / 2)
        .attr('width', SCENE_W).attr('height', SCENE_H)
        .attr('rx', 6).attr('ry', 6)
        .style('fill', fill)
        .style('stroke', stroke)
        .attr('stroke-width', 1.5);
    }

    // Label
    group.append('text')
      .attr('class', 'node-label')
      .text(truncate(d.label, 16))
      .attr('text-anchor', 'middle')
      .attr('y', d.details && (d.weight ?? 0) >= 0.65 ? -6 : 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', d.narrativeRole === 'central' ? '600' : '400')
      .style('fill', 'var(--text-primary)')
      .style('pointer-events', 'none');

    // Short detail snippet inside node for important scenes
    if (d.details && (d.weight ?? 0) >= 0.65 && role !== 'event') {
      group.append('text')
        .text(truncate(d.details, 22))
        .attr('text-anchor', 'middle')
        .attr('y', 10)
        .attr('dominant-baseline', 'central')
        .attr('font-size', '8px')
        .style('fill', 'var(--text-tertiary)')
        .style('pointer-events', 'none');
    }
  });
}
