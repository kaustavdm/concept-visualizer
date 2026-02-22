import { describe, it, expect, vi } from 'vitest';
import { composeLayers } from './compositor';
import type { EntitySpec, Layer3d } from './entity-spec';
import type { AnimationDSL } from './animation-dsl';
import type { MaterialSpec } from './scene-content.types';
import { createPrefabRegistry } from './prefabs';

/** Create a minimal entity spec for testing */
function makeEntity(
  overrides: Partial<EntitySpec> & { id: string },
): EntitySpec {
  return {
    components: { render: { type: 'sphere' } },
    material: { diffuse: [1, 0, 0] },
    ...overrides,
  };
}

/** Create a minimal layer for testing */
function makeLayer(overrides: Partial<Layer3d> & { id: string }): Layer3d {
  return {
    name: overrides.id,
    visible: true,
    text: '',
    entities: [],
    position: overrides.position ?? 'n',
    source: { type: 'manual' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('composeLayers', () => {
  it('returns empty SceneContent when no layers', () => {
    const result = composeLayers([], 'scene-1');

    expect(result.id).toBe('scene-1');
    expect(result.entities).toEqual([]);
    expect(result.onThemeChange).toBeUndefined();
  });

  it('filters out invisible layers', () => {
    const layers = [
      makeLayer({
        id: 'vis',
        visible: true,
        entities: [makeEntity({ id: 'a' })],
      }),
      makeLayer({
        id: 'invis',
        visible: false,
        entities: [makeEntity({ id: 'b' })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('vis:a');
  });

  it('prefixes entity IDs with layer ID', () => {
    const layers = [
      makeLayer({
        id: 'layer1',
        entities: [makeEntity({ id: 'sphere' }), makeEntity({ id: 'box' })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].id).toBe('layer1:sphere');
    expect(result.entities[1].id).toBe('layer1:box');
  });

  it('sorts layers by fractional position', () => {
    const layers = [
      makeLayer({
        id: 'second',
        position: 'n',
        entities: [makeEntity({ id: 'b' })],
      }),
      makeLayer({
        id: 'first',
        position: 'a',
        entities: [makeEntity({ id: 'a' })],
      }),
      makeLayer({
        id: 'third',
        position: 'z',
        entities: [makeEntity({ id: 'c' })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities.map((e) => e.id)).toEqual([
      'first:a',
      'second:b',
      'third:c',
    ]);
  });

  it('resolves AnimationDSL to animate callbacks', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'y', speed: 0.25 };
    const layers = [
      makeLayer({
        id: 'L',
        entities: [makeEntity({ id: 'spinner', animate: dsl })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    // The entity should now have an animate function (resolved from DSL)
    expect(result.entities[0].animate).toBeTypeOf('function');

    // Verify it actually works — call with a mock entity
    const mockEnt = {
      setEulerAngles: vi.fn(),
      setPosition: vi.fn(),
      getPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      getEulerAngles: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    };
    result.entities[0].animate!(mockEnt as any, {
      time: 1,
      dt: 1 / 60,
      entities: {},
    });

    // rotate Y at 0.25 rev/s * 1s * 360 = 90 degrees (base rotation is 0)
    expect(mockEnt.setEulerAngles).toHaveBeenCalledWith(0, 90, 0);
  });

  it('generates onThemeChange from themeResponse fields', () => {
    const lightMat: Partial<MaterialSpec> = {
      diffuse: [0.9, 0.9, 0.9],
      emissive: [0, 0, 0],
    };
    const darkMat: Partial<MaterialSpec> = {
      diffuse: [0.1, 0.1, 0.1],
      emissive: [0.2, 0, 0],
    };

    const layers = [
      makeLayer({
        id: 'L1',
        entities: [
          makeEntity({
            id: 'themed',
            themeResponse: { light: lightMat, dark: darkMat },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.onThemeChange).toBeTypeOf('function');

    // Build a mock pc.Entity with render.meshInstances[0].material
    const mockMaterial = {
      diffuse: { set: vi.fn() },
      emissive: { set: vi.fn() },
      specular: { set: vi.fn() },
      metalness: 0,
      gloss: 0,
      update: vi.fn(),
    };
    const mockPcEntity = {
      render: {
        meshInstances: [{ material: mockMaterial }],
      },
    };

    // Call onThemeChange with 'dark' theme and the namespaced entity map
    result.onThemeChange!('dark', {
      'L1:themed': mockPcEntity,
    } as any);

    // Should apply dark material overrides
    expect(mockMaterial.diffuse.set).toHaveBeenCalledWith(0.1, 0.1, 0.1);
    expect(mockMaterial.emissive.set).toHaveBeenCalledWith(0.2, 0, 0);
    expect(mockMaterial.update).toHaveBeenCalled();
  });

  it('entities without animate DSL have no animate callback', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [makeEntity({ id: 'static' })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].animate).toBeUndefined();
  });

  it('sets mesh field from components.render.type for backward compat', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [makeEntity({ id: 'sphere', components: { render: { type: 'box' } } })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].mesh).toBe('box');
  });

  it('sets mesh field from components.render.geometry when present', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({
            id: 'custom',
            components: {
              render: {
                type: 'cone',
                geometry: {
                  type: 'cone',
                  capSegments: 32,
                  baseRadius: 1,
                  peakRadius: 0,
                  height: 2,
                  heightSegments: 1,
                },
              },
            },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].mesh).toEqual({
      type: 'cone',
      capSegments: 32,
      baseRadius: 1,
      peakRadius: 0,
      height: 2,
      heightSegments: 1,
    });
  });

  it('flattens children with parent field and nested ID namespace', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({
            id: 'parent',
            children: [makeEntity({ id: 'child' })],
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('L:parent');
    expect(result.entities[1].id).toBe('L:parent/child');
    expect(result.entities[1].parent).toBe('L:parent');
  });

  it('flattens deeply nested children', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({
            id: 'root',
            children: [
              makeEntity({
                id: 'mid',
                children: [makeEntity({ id: 'leaf' })],
              }),
            ],
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities).toHaveLength(3);
    expect(result.entities[0].id).toBe('L:root');
    expect(result.entities[1].id).toBe('L:root/mid');
    expect(result.entities[1].parent).toBe('L:root');
    expect(result.entities[2].id).toBe('L:root/mid/leaf');
    expect(result.entities[2].parent).toBe('L:root/mid');
  });

  it('resolves bare animation center refs to namespaced IDs', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({ id: 'hub' }),
          makeEntity({
            id: 'orbiter',
            animate: { type: 'orbit', center: 'hub', radius: 3, speed: 1 },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    const orbiterSpec = result.entities.find((e) => e.id === 'L:orbiter')!;
    expect(orbiterSpec.animate).toBeTypeOf('function');
  });

  it('resolves lookAt target refs to namespaced IDs', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({ id: 'target' }),
          makeEntity({
            id: 'watcher',
            animate: { type: 'lookat', target: 'target' },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    const watcherSpec = result.entities.find((e) => e.id === 'L:watcher')!;
    expect(watcherSpec.animate).toBeTypeOf('function');
  });

  it('passes through already-namespaced refs (containing colon)', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({
            id: 'orbiter',
            animate: { type: 'orbit', center: 'other:hub', radius: 3, speed: 1 },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    const orbiterSpec = result.entities.find((e) => e.id === 'L:orbiter')!;
    expect(orbiterSpec.animate).toBeTypeOf('function');
  });

  it('resolves prefabs via provided registry', () => {
    const registry = createPrefabRegistry();
    registry.register({
      id: 'glowing-sphere',
      description: 'A glowing sphere',
      template: {
        components: { render: { type: 'sphere' } },
        material: { diffuse: [0, 1, 0] },
        scale: [2, 2, 2],
      },
      slots: [],
    });

    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          {
            id: 'orb',
            prefab: 'glowing-sphere',
            components: { render: { type: 'sphere' } },
            position: [1, 2, 3],
          },
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1', registry);

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('L:orb');
    // Prefab provides scale, entity provides position
    expect(result.entities[0].scale).toEqual([2, 2, 2]);
    expect(result.entities[0].position).toEqual([1, 2, 3]);
  });

  it('passes through label and tags fields', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({ id: 'node', label: 'My Node', tags: ['concept', 'main'] }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].label).toBe('My Node');
    expect(result.entities[0].tags).toEqual(['concept', 'main']);
  });

  it('passes through followable field', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [makeEntity({ id: 'mover', followable: true })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].followable).toBe(true);
  });

  it('maps grid render component to opacity spec for grid floor', () => {
    const layers = [
      makeLayer({
        id: 'ground',
        entities: [
          makeEntity({
            id: 'floor',
            components: { render: { type: 'plane', grid: { tiling: 4 } } },
            position: [0, -1, 0],
            scale: [80, 1, 80],
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].opacity).toEqual({
      map: 'grid',
      tiling: 4,
      blend: true,
    });
  });

  it('does not set opacity when render component has no grid', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [makeEntity({ id: 'plane', components: { render: { type: 'plane' } } })],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].opacity).toBeUndefined();
  });

  it('passes through components to SceneEntitySpec', () => {
    const layers = [
      makeLayer({
        id: 'L',
        entities: [
          makeEntity({
            id: 'lit',
            components: {
              render: { type: 'sphere' },
              light: { type: 'omni', intensity: 2 },
            },
          }),
        ],
      }),
    ];

    const result = composeLayers(layers, 'scene-1');

    expect(result.entities[0].components?.light?.type).toBe('omni');
  });
});
