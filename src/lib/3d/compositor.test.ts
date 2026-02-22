import { describe, it, expect, vi } from 'vitest';
import { composeLayers } from './compositor';
import type { Layer3d, SerializableEntitySpec } from './types';
import type { AnimationDSL } from './animation-dsl';
import type { MaterialSpec } from './scene-content.types';

/** Create a minimal entity spec for testing */
function makeEntity(
  overrides: Partial<SerializableEntitySpec> & { id: string },
): SerializableEntitySpec {
  return {
    mesh: 'sphere',
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
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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
        order: 0,
        entities: [makeEntity({ id: 'a' })],
      }),
      makeLayer({
        id: 'invis',
        visible: false,
        order: 1,
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

  it('sorts layers by order ascending', () => {
    const layers = [
      makeLayer({
        id: 'second',
        order: 2,
        entities: [makeEntity({ id: 'b' })],
      }),
      makeLayer({
        id: 'first',
        order: 1,
        entities: [makeEntity({ id: 'a' })],
      }),
      makeLayer({
        id: 'third',
        order: 3,
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
});
