// src/lib/3d/observation-modes/epistemology.test.ts
import { describe, it, expect } from 'vitest';
import { epistemologyMode } from './epistemology';

const schema = {
	type: 'graph' as const,
	title: 'Knowledge Test',
	description: 'An epistemology test',
	nodes: [
		{ id: 'a', label: 'Earth is round', modeRole: 'claim', weight: 0.9 },
		{ id: 'b', label: 'Satellite photos', modeRole: 'evidence', weight: 0.8 },
		{ id: 'c', label: 'Observation', modeRole: 'means', weight: 0.6 },
		{ id: 'd', label: 'Senses are reliable', modeRole: 'assumption', weight: 0.5 },
		{ id: 'e', label: 'Cannot see all', modeRole: 'limit', weight: 0.4 },
	],
	edges: [
		{ source: 'b', target: 'a', label: 'supports', strength: 0.8 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('epistemologyMode', () => {
	it('has correct id and roles', () => {
		expect(epistemologyMode.id).toBe('epistemology');
		expect(epistemologyMode.roles.length).toBe(5);
		expect(epistemologyMode.roles.map(r => r.id)).toContain('claim');
		expect(epistemologyMode.roles.map(r => r.id)).toContain('evidence');
		expect(epistemologyMode.roles.map(r => r.id)).toContain('means');
		expect(epistemologyMode.roles.map(r => r.id)).toContain('assumption');
		expect(epistemologyMode.roles.map(r => r.id)).toContain('limit');
	});

	it('renders 3+ layers from schema', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses epistemology prefabs for entities', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const claimEntity = concepts!.entities.find(e => e.prefab === 'epistemology:claim');
		expect(claimEntity).toBeDefined();
		const evidenceEntity = concepts!.entities.find(e => e.prefab === 'epistemology:evidence');
		expect(evidenceEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Earth is round');
	});

	it('declares prefabs for all roles', () => {
		expect(epistemologyMode.prefabs.length).toBe(5);
		const prefabIds = epistemologyMode.prefabs.map(p => p.id);
		for (const role of epistemologyMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions claim nodes at inner ring (small radius)', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const claimEntity = concepts!.entities.find(e => e.prefab === 'epistemology:claim');
		const pos = claimEntity!.position!;
		const radius = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
		// Claim ring radius is ~2
		expect(radius).toBeLessThanOrEqual(3);
	});

	it('positions limit nodes at outer ring (large radius)', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const limitEntity = concepts!.entities.find(e => e.prefab === 'epistemology:limit');
		const pos = limitEntity!.position!;
		const radius = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
		// Limit ring radius is ~7
		expect(radius).toBeGreaterThanOrEqual(6);
	});

	it('creates connection entities from edges', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('supports');
	});

	it('creates environment layer with torus rings (no ground plane)', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();

		// Three torus rings
		const rings = env!.entities.filter(e => e.components.render?.type === 'torus');
		expect(rings.length).toBe(3);

		// No ground plane
		const ground = env!.entities.find(e => e.id === 'ground');
		expect(ground).toBeUndefined();
		const planes = env!.entities.filter(e => e.components.render?.type === 'plane');
		expect(planes.length).toBe(0);

		// Has a light
		const light = env!.entities.find(e => e.components.light);
		expect(light).toBeDefined();
		expect(light!.components.light!.color).toEqual([0.85, 0.9, 1.0]);
	});

	it('sets observationMode on all layers', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('epistemology');
		}
	});

	it('handles schema with no nodes gracefully', () => {
		const emptySchema = {
			type: 'graph' as const,
			title: 'Empty',
			description: 'No nodes',
			nodes: [],
			edges: [],
			metadata: { concepts: [], relationships: [] },
		};
		const layers = epistemologyMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});

	it('maps weight to material opacity (certainty-as-opacity)', () => {
		const layers = epistemologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');

		// High certainty claim (weight=0.9) → opacity = 0.4 + 0.9*0.6 = 0.94
		const claim = concepts!.entities.find(e => e.prefab === 'epistemology:claim');
		expect(claim!.material?.opacity).toBeCloseTo(0.94, 2);
		expect(claim!.material?.blendType).toBe('normal');

		// Lower certainty limit (weight=0.4) → opacity = 0.4 + 0.4*0.6 = 0.64
		const limit = concepts!.entities.find(e => e.prefab === 'epistemology:limit');
		expect(limit!.material?.opacity).toBeCloseTo(0.64, 2);
		expect(limit!.material?.blendType).toBe('normal');
	});

	it('defaults to 0.5 weight for nodes without weight', () => {
		const noWeightSchema = {
			type: 'graph' as const,
			title: 'No Weight',
			description: 'No weight test',
			nodes: [{ id: 'x', label: 'Unknown', modeRole: 'claim' }],
			edges: [],
			metadata: { concepts: [], relationships: [] },
		};
		const layers = epistemologyMode.render(noWeightSchema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		// Default weight 0.5 → opacity = 0.4 + 0.5*0.6 = 0.7
		expect(entity.material?.opacity).toBeCloseTo(0.7, 2);
	});
});
