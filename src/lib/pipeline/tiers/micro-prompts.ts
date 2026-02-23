/**
 * Micro-prompt builders for Tier 3 LLM enrichment.
 *
 * Each function builds a short prompt (~50-100 tokens) and specifies
 * the expected JSON response format. parseFlatJson provides lenient
 * parsing of LLM responses (handles markdown fences, whitespace, etc.).
 */

/**
 * Build a prompt to name concept clusters in 1-3 words.
 */
export function buildThemePrompt(
  title: string,
  clusters: Record<string, string[]>,
): string {
  const lines = Object.entries(clusters)
    .map(([key, labels]) => `${key}: ${labels.join(', ')}`)
    .join('\n');

  return (
    `These concept clusters were found in text about "${title}":\n` +
    `${lines}\n` +
    `Name each cluster in 1-3 words. Reply as JSON: {${Object.keys(clusters).map((k) => `"${k}": "name"`).join(', ')}}`
  );
}

/**
 * Build a prompt to classify each node's role from a set of mode-specific roles.
 */
export function buildRolePrompt(
  nodeLabels: string[],
  roles: Array<{ id: string; label: string; description: string }>,
  storyFocus: string,
): string {
  const roleList = roles.map((r) => `${r.id}: ${r.description}`).join('\n');
  const concepts = nodeLabels.join(', ');

  return (
    `${storyFocus}\nConcepts: ${concepts}\nRoles:\n${roleList}\n` +
    `Classify each concept. Reply as JSON: {${nodeLabels.map((l) => `"${l}": "role_id"`).join(', ')}}`
  );
}

/**
 * Build a prompt to label each edge relationship in 2-4 words.
 */
export function buildEdgeLabelPrompt(
  edges: Array<{ source: string; target: string }>,
): string {
  const lines = edges.map((e) => `${e.source} → ${e.target}`).join('\n');
  const keys = edges
    .map((e) => `"${e.source}→${e.target}": "label"`)
    .join(', ');

  return (
    `These concept pairs are related:\n${lines}\n` +
    `Label each in 2-4 words. Reply as JSON: {${keys}}`
  );
}

/**
 * Build a prompt to write 1-sentence descriptions for each concept.
 */
export function buildDescriptionPrompt(nodeLabels: string[]): string {
  const concepts = nodeLabels.join(', ');
  const keys = nodeLabels.map((l) => `"${l}": "description"`).join(', ');

  return (
    `Write a 1-sentence description for each concept: ${concepts}\n` +
    `Reply as JSON: {${keys}}`
  );
}

/**
 * Parse a flat JSON object from an LLM response string.
 * Handles markdown fences, surrounding whitespace, and returns null on failure.
 */
export function parseFlatJson(raw: string): Record<string, string> | null {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (match) cleaned = match[1].trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
