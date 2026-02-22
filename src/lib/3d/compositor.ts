import type * as pc from 'playcanvas';
import type { EntitySpec, Layer3d, MaterialSpec } from './entity-spec';
import type {
  SceneContent,
  SceneEntitySpec,
  MaterialSpec as SceneContentMaterialSpec,
} from './scene-content.types';
import { resolveAnimation } from './animation-dsl';
import type { AnimationDSL } from './animation-dsl';
import { resolvePrefab, type PrefabRegistry } from './prefabs';

/**
 * Mapping from a serializable entity + its layer ID to the theme overrides
 * it declares. Used internally to build the composite onThemeChange callback.
 */
interface ThemeEntry {
  namespacedId: string;
  light?: Partial<MaterialSpec>;
  dark?: Partial<MaterialSpec>;
}

/**
 * Apply material overrides from a Partial<MaterialSpec> to a pc.StandardMaterial.
 * Only sets properties that are present in the override object.
 */
function applyMaterialOverrides(
  mat: pc.StandardMaterial,
  overrides: Partial<MaterialSpec>,
): void {
  if (overrides.diffuse) {
    (mat.diffuse as any).set(
      overrides.diffuse[0],
      overrides.diffuse[1],
      overrides.diffuse[2],
    );
  }
  if (overrides.emissive) {
    (mat.emissive as any).set(
      overrides.emissive[0],
      overrides.emissive[1],
      overrides.emissive[2],
    );
  }
  if (overrides.specular) {
    (mat.specular as any).set(
      overrides.specular[0],
      overrides.specular[1],
      overrides.specular[2],
    );
  }
  if (overrides.metalness !== undefined) {
    mat.metalness = overrides.metalness;
  }
  if (overrides.gloss !== undefined) {
    mat.gloss = overrides.gloss;
  }
  mat.update();
}

/**
 * Resolve bare entity ID references in an AnimationDSL to namespaced IDs.
 *
 * Only orbit.center and lookAt.target are resolved.
 * IDs already containing ':' are treated as pre-namespaced and pass through.
 *
 * Resolution order: same-layer first, then cross-layer fallback.
 */
function resolveAnimationRefs(
  dsl: AnimationDSL,
  layerId: string,
  allEntityIds: Set<string>,
): AnimationDSL {
  if (Array.isArray(dsl)) {
    return dsl.map((d) => resolveAnimationRefs(d, layerId, allEntityIds));
  }

  if (dsl.type === 'orbit' && dsl.center) {
    return {
      ...dsl,
      center: resolveRef(dsl.center, layerId, allEntityIds),
    };
  }

  if (dsl.type === 'lookat' && dsl.target) {
    return {
      ...dsl,
      target: resolveRef(dsl.target, layerId, allEntityIds),
    };
  }

  return dsl;
}

/**
 * Resolve a bare entity ID reference to a namespaced ID.
 * Already-namespaced IDs (containing ':') pass through unchanged.
 * Same-layer refs are tried first, then cross-layer.
 */
function resolveRef(
  ref: string,
  layerId: string,
  allEntityIds: Set<string>,
): string {
  // Already namespaced
  if (ref.includes(':')) return ref;

  // Try same-layer first
  const sameLayer = `${layerId}:${ref}`;
  if (allEntityIds.has(sameLayer)) return sameLayer;

  // Try cross-layer (find first match)
  for (const id of allEntityIds) {
    if (id.endsWith(`:${ref}`)) return id;
  }

  // Fallback: namespace to same layer anyway
  return sameLayer;
}

/**
 * Convert an EntitySpec to a SceneEntitySpec.
 * Does NOT recurse into children — call flattenEntity for that.
 */
function toSceneEntity(
  entity: EntitySpec,
  namespacedId: string,
  layerId: string,
  allEntityIds: Set<string>,
  parentNamespacedId?: string,
): SceneEntitySpec {
  const {
    animate: animateDsl,
    themeResponse,
    children,
    prefab,
    components,
    material,
    weight,
    details,
    ...rest
  } = entity;

  const spec: SceneEntitySpec = {
    ...rest,
    id: namespacedId,
    // mesh and material are set below
    mesh: 'sphere', // default, overridden below
    material: (material ?? { diffuse: [0.8, 0.8, 0.8] }) as SceneContentMaterialSpec,
  };

  // Set mesh from components.render for backward compat with createScene
  if (components?.render) {
    if (components.render.geometry) {
      spec.mesh = components.render.geometry as any;
    } else {
      spec.mesh = components.render.type;
    }
  }

  // Pass through components
  if (components) {
    spec.components = components as SceneEntitySpec['components'];
  }

  // Set parent if this is a child entity
  if (parentNamespacedId) {
    spec.parent = parentNamespacedId;
  }

  // Resolve animation refs and convert DSL to callback
  if (animateDsl) {
    const resolved = resolveAnimationRefs(animateDsl, layerId, allEntityIds);
    spec.animate = resolveAnimation(resolved);
  }

  return spec;
}

/**
 * Recursively flatten an entity and its children into a flat array of
 * SceneEntitySpec entries. Children get IDs like `layerId:parentId/childId`
 * and have their `parent` field set.
 */
function flattenEntity(
  entity: EntitySpec,
  layerId: string,
  parentNamespacedId: string | undefined,
  themeEntries: ThemeEntry[],
  allEntityIds: Set<string>,
): SceneEntitySpec[] {
  // Build namespaced ID
  const namespacedId = parentNamespacedId
    ? `${parentNamespacedId}/${entity.id}`
    : `${layerId}:${entity.id}`;

  const spec = toSceneEntity(
    entity,
    namespacedId,
    layerId,
    allEntityIds,
    parentNamespacedId,
  );

  // Collect theme entries
  if (entity.themeResponse) {
    themeEntries.push({
      namespacedId,
      light: entity.themeResponse.light,
      dark: entity.themeResponse.dark,
    });
  }

  const result: SceneEntitySpec[] = [spec];

  // Recurse into children
  if (entity.children) {
    for (const child of entity.children) {
      result.push(
        ...flattenEntity(child, layerId, namespacedId, themeEntries, allEntityIds),
      );
    }
  }

  return result;
}

/**
 * Recursively collect all entity IDs (namespaced) from an entity tree.
 */
function collectEntityIds(
  entity: EntitySpec,
  layerId: string,
  parentNamespacedId: string | undefined,
  ids: Set<string>,
): void {
  const namespacedId = parentNamespacedId
    ? `${parentNamespacedId}/${entity.id}`
    : `${layerId}:${entity.id}`;
  ids.add(namespacedId);

  if (entity.children) {
    for (const child of entity.children) {
      collectEntityIds(child, layerId, namespacedId, ids);
    }
  }
}

/**
 * Compose an array of Layer3d into a single SceneContent object.
 *
 * 1. Filters layers where visible === true
 * 2. Sorts by position (string localeCompare — fractional indexing)
 * 3. Resolves prefabs via optional registry
 * 4. Collects all entity IDs for animation ref resolution
 * 5. Flattens entity hierarchies, prefixing IDs with layer ID
 * 6. Resolves AnimationDSL to callback functions via resolveAnimation()
 * 7. Resolves themeResponse fields into a single onThemeChange callback
 * 8. Returns a SceneContent compatible object
 */
export function composeLayers(
  layers: Layer3d[],
  id: string,
  prefabRegistry?: PrefabRegistry,
): SceneContent {
  // 1. Filter visible layers
  const visible = layers.filter((l) => l.visible);

  // 2. Sort by position (fractional index string comparison)
  visible.sort((a, b) => a.position.localeCompare(b.position));

  // 3. Resolve prefabs if registry provided
  if (prefabRegistry) {
    for (const layer of visible) {
      layer.entities = layer.entities.map((e) =>
        resolvePrefab(e, prefabRegistry),
      );
    }
  }

  // 4. Collect all entity IDs across all layers for animation ref resolution
  const allEntityIds = new Set<string>();
  for (const layer of visible) {
    for (const entity of layer.entities) {
      collectEntityIds(entity, layer.id, undefined, allEntityIds);
    }
  }

  // 5 + 6. Flatten entities and collect theme entries
  const entities: SceneEntitySpec[] = [];
  const themeEntries: ThemeEntry[] = [];

  for (const layer of visible) {
    for (const entity of layer.entities) {
      entities.push(
        ...flattenEntity(entity, layer.id, undefined, themeEntries, allEntityIds),
      );
    }
  }

  // 7. Build composite onThemeChange if any entities have theme responses
  const result: SceneContent = {
    id,
    name: id,
    entities,
  };

  if (themeEntries.length > 0) {
    result.onThemeChange = (
      theme: 'light' | 'dark',
      entityMap: Record<string, pc.Entity>,
    ) => {
      for (const entry of themeEntries) {
        const overrides = theme === 'light' ? entry.light : entry.dark;
        if (!overrides) continue;

        const pcEntity = entityMap[entry.namespacedId];
        if (!pcEntity) continue;

        const meshInstances = pcEntity.render?.meshInstances;
        if (!meshInstances || meshInstances.length === 0) continue;

        const mat = meshInstances[0].material as pc.StandardMaterial;
        applyMaterialOverrides(mat, overrides);
      }
    };
  }

  return result;
}
