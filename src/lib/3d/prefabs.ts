// src/lib/3d/prefabs.ts
import type { EntitySpec } from './entity-spec';

export interface PrefabDefinition {
	id: string;
	description: string;
	template: Omit<EntitySpec, 'id'>;
	slots: string[];
}

export interface PrefabRegistry {
	register(prefab: PrefabDefinition): void;
	get(id: string): PrefabDefinition | undefined;
	list(): PrefabDefinition[];
}

export function createPrefabRegistry(): PrefabRegistry {
	const prefabs = new Map<string, PrefabDefinition>();

	return {
		register(prefab) {
			prefabs.set(prefab.id, prefab);
		},
		get(id) {
			return prefabs.get(id);
		},
		list() {
			return Array.from(prefabs.values());
		},
	};
}

/** Deep merge two objects. `overrides` values win over `base`. Arrays replace, not concatenate. */
function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T {
	const result = { ...base };
	for (const key of Object.keys(overrides) as Array<keyof T>) {
		const baseVal = base[key];
		const overVal = overrides[key];

		if (overVal === undefined) continue;

		if (
			typeof baseVal === 'object' &&
			baseVal !== null &&
			!Array.isArray(baseVal) &&
			typeof overVal === 'object' &&
			overVal !== null &&
			!Array.isArray(overVal)
		) {
			result[key] = deepMerge(
				baseVal as Record<string, unknown>,
				overVal as Record<string, unknown>,
			) as T[keyof T];
		} else {
			result[key] = overVal as T[keyof T];
		}
	}
	return result;
}

/**
 * Resolve a prefab reference on an entity.
 * If entity has `prefab` field, look up the template and deep-merge.
 * Entity fields win over template. Strips `prefab` from result.
 */
export function resolvePrefab(entity: EntitySpec, registry: PrefabRegistry): EntitySpec {
	if (!entity.prefab) {
		// Still recurse into children even if this entity has no prefab
		if (entity.children) {
			return { ...entity, children: entity.children.map(c => resolvePrefab(c, registry)) };
		}
		return entity;
	}

	const definition = registry.get(entity.prefab);
	if (!definition) return entity;

	const { prefab, id, children, ...entityOverrides } = entity;
	const merged = deepMerge(
		definition.template as Record<string, unknown>,
		entityOverrides as Record<string, unknown>,
	) as Omit<EntitySpec, 'id'>;

	const resolved: EntitySpec = { id, ...merged, children };
	// Recurse into children after merge
	if (resolved.children) {
		resolved.children = resolved.children.map(c => resolvePrefab(c, registry));
	}
	return resolved;
}
