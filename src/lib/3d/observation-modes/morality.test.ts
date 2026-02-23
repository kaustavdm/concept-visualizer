// src/lib/3d/observation-modes/morality.test.ts
import { describe, it, expect } from 'vitest';
import { moralityMode } from './morality';

const schema = {
	type: 'graph' as const,
	title: 'Ethics Test',
	description: 'A test of moral concepts',
	nodes: [
		{ id: 'a', label: 'Judge', modeRole: 'agent', weight: 0.9 },
		{ id: 'b', label: 'Victim', modeRole: 'affected', weight: 0.7 },
		{ id: 'c', label: 'Fairness', modeRole: 'value', weight: 0.8 },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'judges', strength: 0.6 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('moralityMode', () => {
	it('has correct id and roles', () => {
		expect(moralityMode.id).toBe('morality');
		expect(moralityMode.roles.length).toBe(6);
		expect(moralityMode.roles.map(r => r.id)).toContain('agent');
		expect(moralityMode.roles.map(r => r.id)).toContain('tension');
	});

	it('renders 3+ layers from schema', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses morality prefabs for entities', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const agentEntity = concepts!.entities.find(e => e.prefab === 'morality:agent');
		expect(agentEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Judge');
	});

	it('declares prefabs for all roles', () => {
		expect(moralityMode.prefabs.length).toBe(6);
		const prefabIds = moralityMode.prefabs.map(p => p.id);
		for (const role of moralityMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions agent nodes on +X side', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const agentEntity = concepts!.entities.find(e => e.prefab === 'morality:agent');
		expect(agentEntity!.position![0]).toBeGreaterThan(0);
	});

	it('positions affected nodes on -X side', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const affectedEntity = concepts!.entities.find(e => e.prefab === 'morality:affected');
		expect(affectedEntity!.position![0]).toBeLessThan(0);
	});

	it('positions value nodes above mid-height', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const valueEntity = concepts!.entities.find(e => e.prefab === 'morality:value');
		expect(valueEntity!.position![1]).toBeGreaterThanOrEqual(3);
	});

	it('creates connection entities from edges', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('judges');
	});

	it('creates environment layer with ground plane and light', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();
		const ground = env!.entities.find(e => e.id === 'ground');
		expect(ground).toBeDefined();
		expect(ground!.material!.diffuse).toEqual([0.15, 0.12, 0.1]);
		const light = env!.entities.find(e => e.components.light);
		expect(light).toBeDefined();
	});

	it('sets observationMode on all layers', () => {
		const layers = moralityMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('morality');
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
		const layers = moralityMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});

	it('handles nodes with tension role at center', () => {
		const tensionSchema = {
			type: 'graph' as const,
			title: 'Tension',
			description: 'A tension test',
			nodes: [
				{ id: 't1', label: 'Dilemma', modeRole: 'tension', weight: 1.0 },
			],
			edges: [],
			metadata: { concepts: [], relationships: [] },
		};
		const layers = moralityMode.render(tensionSchema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const tensionEntity = concepts!.entities.find(e => e.prefab === 'morality:tension');
		expect(tensionEntity).toBeDefined();
		expect(tensionEntity!.position).toEqual([0, 1.5, 0]);
	});
});
