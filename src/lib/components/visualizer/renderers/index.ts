import type { VisualizationSchema, VisualizationType } from '$lib/types';
import { renderGraph } from './graph';
import { renderTree } from './tree';
import { renderFlowchart } from './flowchart';
import { renderHierarchy } from './hierarchy';

type Renderer = (svg: SVGSVGElement, schema: VisualizationSchema) => void;

const renderers: Record<VisualizationType, Renderer> = {
  graph: renderGraph,
  tree: renderTree,
  flowchart: renderFlowchart,
  hierarchy: renderHierarchy
};

export function renderVisualization(svg: SVGSVGElement, schema: VisualizationSchema): void {
  const renderer = renderers[schema.type];
  if (!renderer) {
    throw new Error(`Unknown visualization type: ${schema.type}`);
  }
  renderer(svg, schema);
}
