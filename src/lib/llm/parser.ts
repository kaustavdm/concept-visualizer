import type { VisualizationSchema } from '$lib/types';

const VALID_TYPES = ['graph', 'tree', 'flowchart', 'hierarchy', 'logicalflow', 'storyboard'];

export function parseVisualizationResponse(raw: string): VisualizationSchema {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM response is not valid JSON');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate required fields
  if (!obj.type || !VALID_TYPES.includes(obj.type as string)) {
    throw new Error(`Invalid visualization type: ${obj.type}`);
  }
  if (!obj.title || typeof obj.title !== 'string') {
    throw new Error('Missing or invalid title');
  }
  if (!obj.description || typeof obj.description !== 'string') {
    throw new Error('Missing or invalid description');
  }
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error('Missing or empty nodes array');
  }
  if (!Array.isArray(obj.edges)) {
    throw new Error('Missing edges array');
  }
  if (!obj.metadata || typeof obj.metadata !== 'object') {
    throw new Error('Missing metadata object');
  }

  const nodeIds = new Set((obj.nodes as Array<{ id: string }>).map(n => n.id));

  for (const edge of obj.edges as Array<{ source: string; target: string }>) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge references invalid source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge references invalid target node: ${edge.target}`);
    }
  }

  return parsed as VisualizationSchema;
}
