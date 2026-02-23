// src/lib/3d/observation-modes/appearance.test.ts
import { describe, it, expect } from 'vitest';
import { appearanceMode } from './appearance';

const schema = {
	type: 'graph' as const,
	title: 'Appearance Test',
	description: 'Surface vs depth',
	nodes: [
		{ id: 'a', label: 'Smile', modeRole: 'surface', weight: 0.8 },
		{ id: 'b', label: 'Grief', modeRole: 'depth', weight: 0.9 },
		{ id: 'c', label: 'Empathy', modeRole: 'lens', weight: 0.6 },
		{ id: 'd', label: 'Politeness', modeRole: 'veil', weight: 0.5 },
		{ id: 'e', label: 'Tear', modeRole: 'marker', weight: 0.7 },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'conceals', strength: 0.8 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('appearanceMode', () => {
	it('has correct id and roles', () => {
		expect(appearanceMode.id).toBe('appearance');
		expect(appearanceMode.roles.length).toBe(5);
		expect(appearanceMode.roles.map(r => r.id)).toEqual([
			'surface', 'depth', 'lens', 'veil', 'marker',
		]);
	});

	it('renders 3+ layers from schema', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses appearance prefabs for entities', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const surfaceEntity = concepts!.entities.find(e => e.prefab === 'appearance:surface');
		expect(surfaceEntity).toBeDefined();
		const depthEntity = concepts!.entities.find(e => e.prefab === 'appearance:depth');
		expect(depthEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Smile');
	});

	it('declares prefabs for all roles', () => {
		expect(appearanceMode.prefabs.length).toBe(5);
		const prefabIds = appearanceMode.prefabs.map(p => p.id);
		for (const role of appearanceMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions surface nodes at high Y (upper plane)', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const surfaceEntity = concepts!.entities.find(e => e.prefab === 'appearance:surface');
		expect(surfaceEntity!.position![1]).toBe(4);
	});

	it('positions depth nodes at low Y (lower plane)', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const depthEntity = concepts!.entities.find(e => e.prefab === 'appearance:depth');
		expect(depthEntity!.position![1]).toBe(0.5);
	});

	it('positions lens nodes at mid-height', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const lensEntity = concepts!.entities.find(e => e.prefab === 'appearance:lens');
		expect(lensEntity!.position![1]).toBe(2);
	});

	it('creates connection entities from edges', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('conceals');
	});

	it('creates environment layer with two reference planes and two lights', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();

		const upperPlane = env!.entities.find(e => e.id === 'upper-plane');
		expect(upperPlane).toBeDefined();
		expect(upperPlane!.position).toEqual([0, 4.5, 0]);
		expect(upperPlane!.material!.diffuse).toEqual([0.8, 0.75, 0.65]);

		const lowerPlane = env!.entities.find(e => e.id === 'lower-plane');
		expect(lowerPlane).toBeDefined();
		expect(lowerPlane!.position).toEqual([0, 0, 0]);
		expect(lowerPlane!.material!.diffuse).toEqual([0.15, 0.15, 0.3]);

		const lights = env!.entities.filter(e => e.components.light);
		expect(lights.length).toBe(2);
	});

	it('sets observationMode on all layers', () => {
		const layers = appearanceMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('appearance');
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
		const layers = appearanceMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});
});
