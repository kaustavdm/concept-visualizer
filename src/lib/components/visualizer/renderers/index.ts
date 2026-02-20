import type { VisualizationSchema, VisualizationType } from '$lib/types';
import { renderGraph } from './graph';
import { renderTree } from './tree';
import { renderFlowchart } from './flowchart';
import { renderHierarchy } from './hierarchy';
import { renderLogicalFlow } from './logicalflow';
import { renderStoryboard } from './storyboard';

type Renderer = (svg: SVGSVGElement, schema: VisualizationSchema) => void;

const renderers: Record<VisualizationType, Renderer> = {
  graph: renderGraph,
  tree: renderTree,
  flowchart: renderFlowchart,
  hierarchy: renderHierarchy,
  logicalflow: renderLogicalFlow,
  storyboard: renderStoryboard
};

export function renderVisualization(svg: SVGSVGElement, schema: VisualizationSchema): void {
  const renderer = renderers[schema.type];
  if (!renderer) {
    throw new Error(`Unknown visualization type: ${schema.type}`);
  }
  renderer(svg, schema);
}
