// src/lib/3d/observation-modes/registry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createObservationModeRegistry } from './registry';
import type { ObservationMode } from './types';

const mockMode: ObservationMode = {
	id: 'test',
	name: 'Test Mode',
	description: 'A test mode',
	roles: [],
	prefabs: [],
	storyFocus: 'Test focus',
	render: vi.fn(() => []),
};

describe('ObservationModeRegistry', () => {
	it('registers and retrieves a mode', () => {
		const registry = createObservationModeRegistry();
		registry.register(mockMode);
		expect(registry.getMode('test')).toBe(mockMode);
	});

	it('returns undefined for unknown mode', () => {
		const registry = createObservationModeRegistry();
		expect(registry.getMode('nope')).toBeUndefined();
	});

	it('lists all modes', () => {
		const registry = createObservationModeRegistry();
		registry.register(mockMode);
		expect(registry.listModes()).toHaveLength(1);
	});

	it('buildPrefabRegistry collects prefabs from all modes', () => {
		const registry = createObservationModeRegistry();
		const modeA: ObservationMode = {
			...mockMode,
			id: 'a',
			prefabs: [
				{ id: 'a:node', description: 'node', template: { components: {} }, slots: [] },
			],
		};
		const modeB: ObservationMode = {
			...mockMode,
			id: 'b',
			prefabs: [
				{ id: 'b:edge', description: 'edge', template: { components: {} }, slots: [] },
				{ id: 'b:label', description: 'label', template: { components: {} }, slots: [] },
			],
		};
		registry.register(modeA);
		registry.register(modeB);

		const prefabRegistry = registry.buildPrefabRegistry();

		expect(prefabRegistry.get('a:node')).toBeDefined();
		expect(prefabRegistry.get('b:edge')).toBeDefined();
		expect(prefabRegistry.get('b:label')).toBeDefined();
		expect(prefabRegistry.list()).toHaveLength(3);
	});

	it('buildPrefabRegistry returns empty registry when no modes have prefabs', () => {
		const registry = createObservationModeRegistry();
		registry.register(mockMode); // mockMode has prefabs: []

		const prefabRegistry = registry.buildPrefabRegistry();
		expect(prefabRegistry.list()).toHaveLength(0);
	});
});
