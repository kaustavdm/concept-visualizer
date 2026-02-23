// src/lib/3d/observation-modes/debate.test.ts
import { describe, it, expect } from 'vitest';
import { debateMode } from './debate';

const schema = {
	type: 'graph' as const,
	title: 'Debate Test',
	description: 'A dialectic test',
	nodes: [
		{ id: 'a', label: 'Free Will', modeRole: 'position', weight: 0.9 },
		{ id: 'b', label: 'Determinism', modeRole: 'counter', weight: 0.8 },
		{ id: 'c', label: 'Compatibilism', modeRole: 'resolution', weight: 0.7 },
		{ id: 'd', label: 'Choice Paradox', modeRole: 'tension', weight: 0.6 },
		{ id: 'e', label: 'Human Agency', modeRole: 'ground', weight: 0.5 },
	],
	edges: [
		{ source: 'a', target: 'b', label: 'opposes', strength: 0.9 },
	],
	metadata: { concepts: [], relationships: [] },
};

describe('debateMode', () => {
	it('has correct id and roles', () => {
		expect(debateMode.id).toBe('debate');
		expect(debateMode.roles.length).toBe(5);
		expect(debateMode.roles.map(r => r.id)).toContain('position');
		expect(debateMode.roles.map(r => r.id)).toContain('counter');
		expect(debateMode.roles.map(r => r.id)).toContain('resolution');
		expect(debateMode.roles.map(r => r.id)).toContain('tension');
		expect(debateMode.roles.map(r => r.id)).toContain('ground');
	});

	it('renders 3+ layers from schema', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('uses debate prefabs for entities', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts).toBeDefined();
		const positionEntity = concepts!.entities.find(e => e.prefab === 'debate:position');
		expect(positionEntity).toBeDefined();
	});

	it('includes text label children on concept entities', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const entity = concepts!.entities[0];
		const labelChild = entity.children?.find(c => c.components.text);
		expect(labelChild).toBeDefined();
		expect(labelChild!.components.text!.text).toBe('Free Will');
	});

	it('declares prefabs for all roles', () => {
		expect(debateMode.prefabs.length).toBe(5);
		const prefabIds = debateMode.prefabs.map(p => p.id);
		for (const role of debateMode.roles) {
			expect(prefabIds).toContain(role.prefab);
		}
	});

	it('positions position nodes on -X side (left)', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const positionEntity = concepts!.entities.find(e => e.prefab === 'debate:position');
		expect(positionEntity!.position![0]).toBeLessThan(0);
	});

	it('positions counter nodes on +X side (right)', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const counterEntity = concepts!.entities.find(e => e.prefab === 'debate:counter');
		expect(counterEntity!.position![0]).toBeGreaterThan(0);
	});

	it('positions resolution nodes at center (X ~ 0)', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const concepts = layers.find(l => l.name === 'Concepts');
		const resolutionEntity = concepts!.entities.find(e => e.prefab === 'debate:resolution');
		expect(resolutionEntity!.position![0]).toBe(0);
	});

	it('creates connection entities from edges', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const connections = layers.find(l => l.name === 'Connections');
		expect(connections).toBeDefined();
		expect(connections!.entities.length).toBe(1);
		expect(connections!.entities[0].label).toBe('opposes');
	});

	it('creates environment layer with arena ring and overhead light', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		const env = layers.find(l => l.name === 'Environment');
		expect(env).toBeDefined();
		const arenaRing = env!.entities.find(e => e.id === 'arena-ring');
		expect(arenaRing).toBeDefined();
		expect(arenaRing!.components.render!.type).toBe('torus');
		const light = env!.entities.find(e => e.components.light);
		expect(light).toBeDefined();
		expect(light!.components.light!.castShadows).toBe(true);
		expect(light!.position).toEqual([0, 10, 0]);
	});

	it('sets observationMode on all layers', () => {
		const layers = debateMode.render(schema, { theme: 'dark' });
		for (const layer of layers) {
			expect(layer.observationMode).toBe('debate');
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
		const layers = debateMode.render(emptySchema, { theme: 'dark' });
		expect(layers.length).toBeGreaterThanOrEqual(3);
		const concepts = layers.find(l => l.name === 'Concepts');
		expect(concepts!.entities.length).toBe(0);
	});
});
