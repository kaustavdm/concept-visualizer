// src/lib/3d/observation-modes/graph.test.ts
import { describe, it, expect } from 'vitest';
import { graphMode } from './graph';
import type { VisualizationSchema } from '$lib/types';

const testSchema: VisualizationSchema = {
	type: 'graph',
	title: 'Test',
	description: 'Test graph',
	nodes: [
		{ id: 'a', label: 'Node A', weight: 0.8, theme: 'core' },
		{ id: 'b', label: 'Node B', weight: 0.5, theme: 'support' },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'relates', strength: 0.7 },
	],
	metadata: { concepts: ['A', 'B'], relationships: ['relates'] },
};

describe('graphMode', () => {
	it('produces 3 layers: environment, concepts, connections', () => {
		const layers = graphMode.render(testSchema, { theme: 'light' });
		expect(layers).toHaveLength(3);
		expect(layers.map(l => l.name)).toEqual(
			expect.arrayContaining(['Environment', 'Concepts', 'Connections'])
		);
	});

	it('creates one entity per node in concepts layer with prefab and text child', () => {
		const layers = graphMode.render(testSchema, { theme: 'light' });
		const concepts = layers.find(l => l.name === 'Concepts')!;
		expect(concepts.entities).toHaveLength(2);
		const nodeA = concepts.entities.find(e => e.id === 'a')!;
		expect(nodeA.prefab).toBe('graph:core');
		expect(nodeA.children).toHaveLength(1);
		expect(nodeA.children![0].components.text?.text).toBe('Node A');
	});

	it('creates one entity per edge in connections layer with rotation', () => {
		const layers = graphMode.render(testSchema, { theme: 'light' });
		const connections = layers.find(l => l.name === 'Connections')!;
		expect(connections.entities).toHaveLength(1);
		const edge = connections.entities[0];
		expect(edge.rotation).toBeDefined();
		// Y-axis is the long axis (length)
		expect(edge.scale![1]).toBeGreaterThan(edge.scale![0]);
	});

	it('applies weight to node scale', () => {
		const layers = graphMode.render(testSchema, { theme: 'light' });
		const concepts = layers.find(l => l.name === 'Concepts')!;
		const nodeA = concepts.entities.find(e => e.label === 'Node A')!;
		expect(nodeA.scale![0]).toBeGreaterThan(1);
	});

	it('tags layers with observation mode', () => {
		const layers = graphMode.render(testSchema, { theme: 'light' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('graph');
		}
	});

	it('has required roles and prefabs', () => {
		expect(graphMode.roles.length).toBe(4);
		expect(graphMode.roles.map(r => r.id)).toEqual(['core', 'supporting', 'peripheral', 'emergent']);
		expect(graphMode.prefabs.length).toBe(4);
		expect(graphMode.storyFocus).toContain('structural importance');
	});
});
