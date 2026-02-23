// src/lib/3d/observation-modes/registry.ts
import type { ObservationMode } from './types';
import { createPrefabRegistry, type PrefabRegistry } from '../prefabs';

export interface ObservationModeRegistry {
	register(mode: ObservationMode): void;
	getMode(id: string): ObservationMode | undefined;
	listModes(): ObservationMode[];
	buildPrefabRegistry(): PrefabRegistry;
}

export function createObservationModeRegistry(): ObservationModeRegistry {
	const modes = new Map<string, ObservationMode>();
	return {
		register(mode) { modes.set(mode.id, mode); },
		getMode(id) { return modes.get(id); },
		listModes() { return Array.from(modes.values()); },
		buildPrefabRegistry() {
			const registry = createPrefabRegistry();
			for (const mode of modes.values()) {
				for (const prefab of mode.prefabs) {
					registry.register(prefab);
				}
			}
			return registry;
		},
	};
}
