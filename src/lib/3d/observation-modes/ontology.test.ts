// src/lib/3d/observation-modes/ontology.test.ts
import { describe, it, expect } from 'vitest';
import { ontologyMode } from './ontology';

const schema = {
	type: 'graph' as const,
	title: 'Knowledge Test',
	description: 'An ontology test',
	nodes: [
		{ id: 'a', label: 'Animal', modeRole: 'category', weight: 0.9 },
		{ id: 'b', label: 'Dog', modeRole: 'instance', weight: 0.7 },
		{ id: 'c', label: 'Speed', modeRole: 'property', weight: 0.5 },
		{ id: 'd', label: 'Running', modeRole: 'process', weight: 0.6 },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'is-a', strength: 0.8 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('ontologyMode', () => {
	it('has correct id and roles', () => {
		expect(ontologyMode.id).toBe('ontology');
		expect(ontologyMode.roles.length).toBe(4);
		expect(ontologyMode.roles.map(r => r.id)).toContain('category');
		expect(ontologyMode.roles.map(r => r.id)).toContain('instance');
		expect(ontologyMode.roles.map(r => r.id)).toContain('property');
		expect(ontologyMode.roles.map(r => r.id)).toContain('process');
	});

	it('renders 3+ layers from schema', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses ontology prefabs for entities', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const categoryEntity = concepts!.entities.find(e => e.prefab === 'ontology:category');
		expect(categoryEntity).toBeDefined();
		const instanceEntity = concepts!.entities.find(e => e.prefab === 'ontology:instance');
		expect(instanceEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Animal');
	});

	it('declares prefabs for all roles', () => {
		expect(ontologyMode.prefabs.length).toBe(4);
		const prefabIds = ontologyMode.prefabs.map(p => p.id);
		for (const role of ontologyMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions category nodes at low Y', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const categoryEntity = concepts!.entities.find(e => e.prefab === 'ontology:category');
		expect(categoryEntity!.position![1]).toBe(0.5);
	});

	it('positions process nodes at high Y', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const processEntity = concepts!.entities.find(e => e.prefab === 'ontology:process');
		expect(processEntity!.position![1]).toBe(3);
	});

	it('creates connection entities from edges', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('is-a');
	});

	it('creates environment layer with ground plane and light', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();
		const ground = env!.entities.find(e => e.id === 'ground');
		expect(ground).toBeDefined();
		expect(ground!.material!.diffuse).toEqual([0.83, 0.77, 0.63]);
		const light = env!.entities.find(e => e.components.light);
		expect(light).toBeDefined();
		expect(light!.position).toEqual([4, 7, -2]);
	});

	it('sets observationMode on all layers', () => {
		const layers = ontologyMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('ontology');
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
		const layers = ontologyMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});
});
