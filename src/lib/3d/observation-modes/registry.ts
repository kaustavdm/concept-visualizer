// src/lib/3d/observation-modes/registry.ts
import type { ObservationMode } from './types';

export interface ObservationModeRegistry {
	register(mode: ObservationMode): void;
	getMode(id: string): ObservationMode | undefined;
	listModes(): ObservationMode[];
}

export function createObservationModeRegistry(): ObservationModeRegistry {
	const modes = new Map<string, ObservationMode>();
	return {
		register(mode) { modes.set(mode.id, mode); },
		getMode(id) { return modes.get(id); },
		listModes() { return Array.from(modes.values()); },
	};
}
