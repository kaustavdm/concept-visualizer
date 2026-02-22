import type * as pc from 'playcanvas';
import type { Layer3d, SerializableEntitySpec } from './types';
import type {
  SceneContent,
  SceneEntitySpec,
  MaterialSpec,
} from './scene-content.types';
import { resolveAnimation } from './animation-dsl';

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
 * Convert a SerializableEntitySpec into a SceneEntitySpec by:
 * - Prefixing the ID with the layer ID
 * - Resolving AnimationDSL to callback (if present)
 * - Stripping the themeResponse field (handled separately)
 */
function toSceneEntity(
  entity: SerializableEntitySpec,
  layerId: string,
): SceneEntitySpec {
  const { animate: animateDsl, themeResponse, ...rest } = entity;

  const spec: SceneEntitySpec = {
    ...rest,
    id: `${layerId}:${entity.id}`,
  };

  if (animateDsl) {
    spec.animate = resolveAnimation(animateDsl);
  }

  return spec;
}

/**
 * Compose an array of Layer3d into a single SceneContent object.
 *
 * 1. Filters layers where visible === true
 * 2. Sorts by order (ascending)
 * 3. Collects all entities, prefixing IDs with layer ID to avoid collisions
 * 4. Resolves AnimationDSL to callback functions via resolveAnimation()
 * 5. Resolves themeResponse fields into a single onThemeChange callback
 * 6. Returns a SceneContent compatible object
 */
export function composeLayers(layers: Layer3d[], id: string): SceneContent {
  // 1. Filter visible layers
  const visible = layers.filter((l) => l.visible);

  // 2. Sort by order ascending
  visible.sort((a, b) => a.order - b.order);

  // 3 + 4. Convert entities and collect theme entries
  const entities: SceneEntitySpec[] = [];
  const themeEntries: ThemeEntry[] = [];

  for (const layer of visible) {
    for (const entity of layer.entities) {
      entities.push(toSceneEntity(entity, layer.id));

      if (entity.themeResponse) {
        themeEntries.push({
          namespacedId: `${layer.id}:${entity.id}`,
          light: entity.themeResponse.light,
          dark: entity.themeResponse.dark,
        });
      }
    }
  }

  // 5. Build composite onThemeChange if any entities have theme responses
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
