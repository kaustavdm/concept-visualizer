import { describe, it, expect } from 'vitest';
import { parseEntityResponse } from './entity-gen';

describe('parseEntityResponse', () => {
	it('parses a valid entity array', () => {
		const raw = JSON.stringify([
			{
				id: 'sphere-1',
				position: [0, 1, 0],
				components: { render: { type: 'sphere' } },
				material: { diffuse: [60, 120, 255] },
			},
		]);
		const result = parseEntityResponse(raw);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('sphere-1');
	});

	it('unwraps {entities: [...]} wrapper', () => {
		const raw = JSON.stringify({
			entities: [
				{
					id: 'box-1',
					components: { render: { type: 'box' } },
				},
			],
		});
		const result = parseEntityResponse(raw);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('box-1');
	});

	it('strips markdown code fences', () => {
		const raw =
			'```json\n' +
			JSON.stringify([
				{ id: 'a', components: { render: { type: 'sphere' } } },
			]) +
			'\n```';
		const result = parseEntityResponse(raw);
		expect(result).toHaveLength(1);
	});

	it('throws on invalid JSON', () => {
		expect(() => parseEntityResponse('not json')).toThrow(
			'not valid JSON',
		);
	});

	it('throws when response is not array or object with entities', () => {
		expect(() => parseEntityResponse('"just a string"')).toThrow(
			'must be a JSON array',
		);
	});

	it('throws on invalid entity structure', () => {
		const raw = JSON.stringify([{ notAnEntity: true }]);
		expect(() => parseEntityResponse(raw)).toThrow('Invalid entity data');
	});
});
