/**
 * Tier 3 — LLM Micro-Prompts enrichment.
 *
 * Takes Tier 2's refined schema (with clusters/themes, refined edges, weights)
 * and uses 3-5 tiny LLM calls to add human-quality labels:
 *
 * 1. Theme naming (~50 tokens): Name each cluster in 1-3 words
 * 2. Role classification (~60 tokens): Classify each node's role (if modeRoles provided)
 * 3. Edge labeling (~60 tokens): Label each edge in 2-4 words
 * 4. Descriptions (optional, enrichmentLevel 'full'): 1-sentence per node
 *
 * Prompts run in parallel. If any prompt fails, Tier 2 values stand (graceful degradation).
 */
import type { VisualizationSchema } from '$lib/types';
import type { TierFn, TierContext } from './types';
import type { ModeRole } from '$lib/3d/observation-modes/types';
import {
  buildThemePrompt,
  buildRolePrompt,
  buildEdgeLabelPrompt,
  buildDescriptionPrompt,
  parseFlatJson,
} from './micro-prompts';

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export interface LLMConfig {
  endpoint: string;
  model: string;
}

export interface Tier3Options {
  llmConfig: LLMConfig;
  enrichmentLevel: 'minimal' | 'full';
  modeRoles?: ModeRole[];
  storyFocus?: string;
}

// ---------------------------------------------------------------------------
// LLM call helper
// ---------------------------------------------------------------------------

async function callLLM(
  prompt: string,
  config: LLMConfig,
  signal: AbortSignal,
): Promise<string> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal,
  });
  if (!response.ok) throw new Error(`LLM ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Tier 3 factory
// ---------------------------------------------------------------------------

export function createTier3(options: Tier3Options): TierFn {
  return async (
    schema: VisualizationSchema,
    ctx: TierContext,
  ): Promise<VisualizationSchema> => {
    if (schema.nodes.length === 0) return schema;

    ctx.onStage('tier3-enriching');

    // Build cluster map from themes
    const clusters: Record<string, string[]> = {};
    for (const node of schema.nodes) {
      const theme = node.theme ?? 'default';
      if (!clusters[theme]) clusters[theme] = [];
      clusters[theme].push(node.label);
    }

    // Build prompts
    const themePrompt = buildThemePrompt(schema.title, clusters);
    const nodeLabels = schema.nodes.map((n) => n.label);

    const rolePrompt =
      options.modeRoles?.length
        ? buildRolePrompt(nodeLabels, options.modeRoles, options.storyFocus ?? '')
        : null;

    const edgePrompt =
      schema.edges.length > 0
        ? buildEdgeLabelPrompt(
            schema.edges.map((e) => ({
              source:
                schema.nodes.find((n) => n.id === e.source)?.label ?? e.source,
              target:
                schema.nodes.find((n) => n.id === e.target)?.label ?? e.target,
            })),
          )
        : null;

    // Fire prompts in parallel (1-3 always, 4 if enrichmentLevel === 'full')
    const promises: Array<{ key: string; promise: Promise<string> }> = [
      {
        key: 'themes',
        promise: callLLM(themePrompt, options.llmConfig, ctx.signal),
      },
    ];

    if (rolePrompt) {
      promises.push({
        key: 'roles',
        promise: callLLM(rolePrompt, options.llmConfig, ctx.signal),
      });
    }

    if (edgePrompt) {
      promises.push({
        key: 'edges',
        promise: callLLM(edgePrompt, options.llmConfig, ctx.signal),
      });
    }

    if (options.enrichmentLevel === 'full') {
      const descPrompt = buildDescriptionPrompt(nodeLabels);
      promises.push({
        key: 'descriptions',
        promise: callLLM(descPrompt, options.llmConfig, ctx.signal),
      });
    }

    // Wait for all, tolerating individual failures
    const results: Record<string, Record<string, string>> = {};
    const settled = await Promise.allSettled(
      promises.map((p) => p.promise),
    );

    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'fulfilled') {
        const parsed = parseFlatJson(
          (settled[i] as PromiseFulfilledResult<string>).value,
        );
        if (parsed) results[promises[i].key] = parsed;
      }
    }

    // Apply results to schema
    const refinedNodes = schema.nodes.map((node) => {
      const updated = { ...node };

      // Theme naming
      if (results.themes && node.theme && results.themes[node.theme]) {
        updated.theme = results.themes[node.theme];
      }

      // Role classification
      if (results.roles && results.roles[node.label]) {
        updated.modeRole = results.roles[node.label];
      }

      // Descriptions
      if (results.descriptions && results.descriptions[node.label]) {
        updated.details = results.descriptions[node.label];
      }

      return updated;
    });

    // Apply edge labels
    const refinedEdges = schema.edges.map((edge) => {
      if (!results.edges) return edge;
      const srcLabel =
        schema.nodes.find((n) => n.id === edge.source)?.label ?? edge.source;
      const tgtLabel =
        schema.nodes.find((n) => n.id === edge.target)?.label ?? edge.target;
      const key = `${srcLabel}\u2192${tgtLabel}`;
      const label = results.edges[key];
      return label ? { ...edge, label } : edge;
    });

    return {
      ...schema,
      nodes: refinedNodes,
      edges: refinedEdges,
    };
  };
}
