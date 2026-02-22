import { describe, it, expect } from 'vitest';
import { validateEntitySpecs } from './entity-validation';

describe('validateEntitySpecs', () => {
	it('returns null for valid entities', () => {
		const entities = [
			{ id: 'a', components: { render: { type: 'sphere' } } },
			{ id: 'b', components: {} },
		];
		expect(validateEntitySpecs(entities)).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(validateEntitySpecs([])).toBeNull();
	});

	it('rejects entity missing id', () => {
		const entities = [{ components: {} }];
		expect(validateEntitySpecs(entities)).toBe('Entity 0: missing "id" (string)');
	});

	it('rejects entity with non-string id', () => {
		const entities = [{ id: 42, components: {} }];
		expect(validateEntitySpecs(entities)).toBe('Entity 0: missing "id" (string)');
	});

	it('rejects entity missing components', () => {
		const entities = [{ id: 'a' }];
		expect(validateEntitySpecs(entities)).toBe(
			'Entity 0: missing "components" (object)',
		);
	});

	it('rejects entity with non-object components', () => {
		const entities = [{ id: 'a', components: 'string' }];
		expect(validateEntitySpecs(entities)).toBe(
			'Entity 0: missing "components" (object)',
		);
	});

	it('rejects non-object entries', () => {
		const entities = ['not an object'];
		expect(validateEntitySpecs(entities)).toBe('Entity 0: must be an object');
	});

	it('reports first invalid entity index', () => {
		const entities = [
			{ id: 'a', components: {} },
			{ id: 'b' }, // missing components
			{ id: 'c', components: {} },
		];
		expect(validateEntitySpecs(entities)).toBe(
			'Entity 1: missing "components" (object)',
		);
	});
});
