import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { parseVisualizationResponse } from './parser';
import type { VisualizationSchema, VisualizationType } from '$lib/types';

interface LLMClientConfig {
  endpoint: string;
  model: string;
}

export async function generateVisualization(
  text: string,
  config: LLMClientConfig,
  vizType?: VisualizationType | null
): Promise<VisualizationSchema> {
  const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(vizType) },
        { role: 'user', content: buildUserPrompt(text) }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return parseVisualizationResponse(content);
}
