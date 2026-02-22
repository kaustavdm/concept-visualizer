// src/lib/3d/observation-modes/registry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createObservationModeRegistry } from './registry';
import type { ObservationMode } from './types';

const mockMode: ObservationMode = {
	id: 'test',
	name: 'Test Mode',
	description: 'A test mode',
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
});
