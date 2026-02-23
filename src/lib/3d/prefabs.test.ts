// src/lib/3d/prefabs.test.ts
import { describe, it, expect } from 'vitest';
import {
	createPrefabRegistry,
	resolvePrefab,
	type PrefabDefinition,
} from './prefabs';
import type { EntitySpec } from './entity-spec';

const testPrefab: PrefabDefinition = {
	id: 'concept-node',
	description: 'Default concept sphere',
	template: {
		components: { render: { type: 'sphere', castShadows: true } },
		material: { diffuse: [0.5, 0.5, 0.5], metalness: 0.3, gloss: 0.6 },
		scale: [1, 1, 1],
	},
	slots: ['material.diffuse', 'scale', 'label', 'position'],
};

describe('PrefabRegistry', () => {
	it('registers and retrieves a prefab', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);
		expect(registry.get('concept-node')).toBe(testPrefab);
	});

	it('returns undefined for unknown prefab', () => {
		const registry = createPrefabRegistry();
		expect(registry.get('nonexistent')).toBeUndefined();
	});

	it('lists all registered prefabs', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);
		expect(registry.list()).toHaveLength(1);
		expect(registry.list()[0].id).toBe('concept-node');
	});
});

describe('resolvePrefab', () => {
	it('returns entity unchanged if no prefab field', () => {
		const registry = createPrefabRegistry();
		const entity: EntitySpec = {
			id: 'test',
			components: { render: { type: 'box' } },
		};
		const result = resolvePrefab(entity, registry);
		expect(result).toEqual(entity);
	});

	it('merges template with entity overrides (entity wins)', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);

		const entity: EntitySpec = {
			id: 'justice',
			prefab: 'concept-node',
			components: {},
			material: { diffuse: [0.2, 0.5, 1.0] },
			position: [0, 2, 0],
			label: 'Justice',
		};

		const result = resolvePrefab(entity, registry);

		// Render component comes from template
		expect(result.components.render?.type).toBe('sphere');
		expect(result.components.render?.castShadows).toBe(true);
		// Material diffuse overridden by entity
		expect(result.material?.diffuse).toEqual([0.2, 0.5, 1.0]);
		// Metalness comes from template
		expect(result.material?.metalness).toBe(0.3);
		// Position from entity
		expect(result.position).toEqual([0, 2, 0]);
		// Scale from template (entity didn't override)
		expect(result.scale).toEqual([1, 1, 1]);
		// prefab field stripped
		expect(result.prefab).toBeUndefined();
		// id preserved
		expect(result.id).toBe('justice');
	});

	it('passes through entity unchanged for unknown prefab', () => {
		const registry = createPrefabRegistry();
		const entity: EntitySpec = {
			id: 'test',
			prefab: 'nonexistent',
			components: { render: { type: 'box' } },
		};
		const result = resolvePrefab(entity, registry);
		expect(result).toEqual(entity);
	});

	it('entity children are not affected by parent prefab', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);

		const entity: EntitySpec = {
			id: 'parent',
			prefab: 'concept-node',
			components: {},
			children: [
				{
					id: 'child',
					components: { render: { type: 'box' } },
				},
			],
		};

		const result = resolvePrefab(entity, registry);
		// Children pass through unchanged
		expect(result.children?.[0].components.render?.type).toBe('box');
	});

	it('recursively resolves prefabs on children', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);
		registry.register({
			id: 'label-plate',
			description: 'A label plate',
			template: {
				components: { text: { text: '' } },
				scale: [2, 2, 2],
			},
			slots: ['text'],
		});

		const entity: EntitySpec = {
			id: 'parent',
			prefab: 'concept-node',
			components: {},
			children: [
				{
					id: 'label',
					prefab: 'label-plate',
					components: {},
				},
			],
		};

		const result = resolvePrefab(entity, registry);

		// Parent resolved from concept-node
		expect(result.components.render?.type).toBe('sphere');
		expect(result.prefab).toBeUndefined();

		// Child resolved from label-plate
		expect(result.children).toHaveLength(1);
		expect(result.children![0].components.text).toBeDefined();
		expect(result.children![0].scale).toEqual([2, 2, 2]);
		expect(result.children![0].prefab).toBeUndefined();
	});

	it('recurses into children even when parent has no prefab', () => {
		const registry = createPrefabRegistry();
		registry.register(testPrefab);

		const entity: EntitySpec = {
			id: 'wrapper',
			components: { render: { type: 'box' } },
			children: [
				{
					id: 'inner',
					prefab: 'concept-node',
					components: {},
				},
			],
		};

		const result = resolvePrefab(entity, registry);

		// Parent untouched
		expect(result.components.render?.type).toBe('box');
		// Child resolved
		expect(result.children![0].components.render?.type).toBe('sphere');
		expect(result.children![0].prefab).toBeUndefined();
	});
});
