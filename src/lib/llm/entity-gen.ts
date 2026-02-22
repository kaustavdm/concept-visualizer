/**
 * Direct entity generation — asks the LLM to produce EntitySpec[] from a description.
 * Bypasses concept extraction pipeline. Used by the Generate button in layer detail.
 */
import type { EntitySpec } from '$lib/3d/entity-spec';
import { validateEntitySpecs } from '$lib/3d/entity-validation';

interface LLMConfig {
	endpoint: string;
	model: string;
}

const ENTITY_GEN_SYSTEM_PROMPT = `You are a 3D scene builder. Given a description, output a JSON array of 3D entities.

You MUST respond with ONLY a valid JSON array — no markdown, no explanation.

Each entity object has this structure:
{
  "id": "unique-kebab-id",
  "position": [x, y, z],
  "rotation": [rx, ry, rz],
  "scale": [sx, sy, sz],
  "components": {
    "render": {
      "type": "sphere | box | plane | cone | cylinder | torus | capsule",
      "castShadows": true
    }
  },
  "material": {
    "diffuse": [r, g, b],
    "emissive": [r, g, b],
    "metalness": 0.0,
    "gloss": 0.5,
    "opacity": 1.0
  },
  "label": "Human-readable name",
  "tags": ["optional-tags"],
  "followable": true
}

Field guidance:
- "position": world-space coordinates [x, y, z]. y is up.
- "rotation": Euler angles in degrees [pitch, yaw, roll].
- "scale": size multipliers [sx, sy, sz]. Default is [1,1,1].
- "diffuse": RGB color in 0.0-1.0 range. Examples: red=[0.9, 0.2, 0.2], blue=[0.2, 0.4, 1.0], yellow=[1.0, 0.9, 0.2], green=[0.2, 0.8, 0.2], white=[1.0, 1.0, 1.0], black=[0.05, 0.05, 0.05].
- "emissive": RGB glow in 0.0-1.0 range. Use [0,0,0] for no glow.
- "metalness": 0.0 = plastic, 1.0 = metal.
- "gloss": 0.0 = rough, 1.0 = shiny mirror.
- "type": The primitive shape. Use "cone" for pyramids/triangles.
- "castShadows": Set true for solid objects, false for ground planes.

Rules:
- Every entity MUST have id, position, components (with render), and material.
- Place objects at the positions described. If no position given, arrange them sensibly.
- Use the exact colors described. "Blue" = [60, 120, 255], "Red" = [230, 50, 50], etc.
- Use the correct shape. "Pyramid" = cone, "Cube" = box, "Ball/Sphere" = sphere.
- Scale objects to look natural. Default sphere radius ~1 unit.
- Include a ground plane entity (type: "plane", y=0, large scale) unless told not to.
- Respond with ONLY the JSON array.`;

export async function generateEntities(
	description: string,
	config: LLMConfig,
): Promise<EntitySpec[]> {
	const url = config.endpoint.replace(/\/$/, '') + '/chat/completions';

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: config.model,
			messages: [
				{ role: 'system', content: ENTITY_GEN_SYSTEM_PROMPT },
				{
					role: 'user',
					content: `Create 3D entities for: ${description}`,
				},
			],
			temperature: 0.3,
			response_format: { type: 'json_object' },
		}),
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

	return parseEntityResponse(content);
}

export function parseEntityResponse(raw: string): EntitySpec[] {
	let cleaned = raw.trim();

	// Strip markdown code fences if present
	const codeBlockMatch = cleaned.match(
		/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/,
	);
	if (codeBlockMatch) {
		cleaned = codeBlockMatch[1].trim();
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		throw new Error('LLM entity response is not valid JSON');
	}

	// Handle both array and {entities: [...]} wrapper
	let entities: unknown[];
	if (Array.isArray(parsed)) {
		entities = parsed;
	} else if (
		typeof parsed === 'object' &&
		parsed !== null &&
		Array.isArray((parsed as Record<string, unknown>).entities)
	) {
		entities = (parsed as Record<string, unknown>).entities as unknown[];
	} else {
		throw new Error(
			'LLM entity response must be a JSON array or {entities: [...]}',
		);
	}

	const validationError = validateEntitySpecs(entities);
	if (validationError) {
		throw new Error(`Invalid entity data: ${validationError}`);
	}

	return entities as EntitySpec[];
}
