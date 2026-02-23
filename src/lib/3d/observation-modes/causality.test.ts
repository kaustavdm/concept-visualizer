// src/lib/3d/observation-modes/causality.test.ts
import { describe, it, expect } from 'vitest';
import { causalityMode } from './causality';

const schema = {
	type: 'graph' as const,
	title: 'Causality Test',
	description: 'A causal chain',
	nodes: [
		{ id: 'a', label: 'Heat', modeRole: 'cause', weight: 0.9 },
		{ id: 'b', label: 'Expansion', modeRole: 'effect', weight: 0.7 },
		{ id: 'c', label: 'Conduction', modeRole: 'mechanism', weight: 0.6 },
		{ id: 'd', label: 'Cooling', modeRole: 'purpose', weight: 0.5 },
		{ id: 'e', label: 'Temperature', modeRole: 'condition', weight: 0.8 },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'produces', strength: 0.9 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('causalityMode', () => {
	it('has correct id and roles', () => {
		expect(causalityMode.id).toBe('causality');
		expect(causalityMode.roles.length).toBe(5);
		expect(causalityMode.roles.map(r => r.id)).toContain('cause');
		expect(causalityMode.roles.map(r => r.id)).toContain('effect');
		expect(causalityMode.roles.map(r => r.id)).toContain('mechanism');
		expect(causalityMode.roles.map(r => r.id)).toContain('purpose');
		expect(causalityMode.roles.map(r => r.id)).toContain('condition');
	});

	it('renders 3+ layers from schema', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses causality prefabs for entities', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const causeEntity = concepts!.entities.find(e => e.prefab === 'causality:cause');
		expect(causeEntity).toBeDefined();
		const effectEntity = concepts!.entities.find(e => e.prefab === 'causality:effect');
		expect(effectEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Heat');
	});

	it('declares prefabs for all roles', () => {
		expect(causalityMode.prefabs.length).toBe(5);
		const prefabIds = causalityMode.prefabs.map(p => p.id);
		for (const role of causalityMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions cause nodes at negative Z (upstream)', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const causeEntity = concepts!.entities.find(e => e.prefab === 'causality:cause');
		expect(causeEntity!.position![2]).toBeLessThan(0);
	});

	it('positions effect nodes at positive Z (downstream)', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const effectEntity = concepts!.entities.find(e => e.prefab === 'causality:effect');
		expect(effectEntity!.position![2]).toBeGreaterThan(0);
	});

	it('mechanism entities have rotate animation', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const mechanismEntity = concepts!.entities.find(e => e.prefab === 'causality:mechanism');
		expect(mechanismEntity).toBeDefined();
		expect(mechanismEntity!.animate).toEqual({ type: 'rotate', axis: 'y', speed: 0.2 });
	});

	it('creates connection entities from edges', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('produces');
	});

	it('creates environment layer with ground and two lights', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();
		const ground = env!.entities.find(e => e.id === 'ground');
		expect(ground).toBeDefined();
		expect(ground!.material!.diffuse).toEqual([0.25, 0.2, 0.15]);
		expect(ground!.scale).toEqual([20, 1, 30]);
		const lights = env!.entities.filter(e => e.components.light);
		expect(lights.length).toBe(2);
	});

	it('sets observationMode on all layers', () => {
		const layers = causalityMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('causality');
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
		const layers = causalityMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});
});
