import { describe, it, expect, vi } from 'vitest';
import { solarLayers, solarScene } from './solar';
import { composeLayers } from '../compositor';
import type { Layer3d } from '../entity-spec';

describe('solarLayers', () => {
  it('exports an array of Layer3d', () => {
    expect(Array.isArray(solarLayers)).toBe(true);
    expect(solarLayers.length).toBeGreaterThan(0);
  });

  it('every layer has required fields', () => {
    for (const layer of solarLayers) {
      expect(layer).toHaveProperty('id');
      expect(layer).toHaveProperty('name');
      expect(typeof layer.visible).toBe('boolean');
      expect(Array.isArray(layer.entities)).toBe(true);
      expect(typeof layer.position).toBe('string');
      expect(layer).toHaveProperty('source');
      expect(layer.source).toHaveProperty('type');
    }
  });

  it('every layer has ISO date strings for createdAt and updatedAt', () => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    for (const layer of solarLayers) {
      expect(layer.createdAt).toMatch(isoDateRegex);
      expect(layer.updatedAt).toMatch(isoDateRegex);
    }
  });

  it('every entity uses components.render.type instead of mesh', () => {
    for (const layer of solarLayers) {
      for (const entity of layer.entities) {
        expect(entity).toHaveProperty('components');
        expect(entity.components.render).toBeDefined();
        expect(typeof entity.components.render!.type).toBe('string');
        // Should not have a top-level 'mesh' property
        expect(entity).not.toHaveProperty('mesh');
      }
    }
  });

  it('layers use source field with type manual', () => {
    for (const layer of solarLayers) {
      expect(layer.source).toEqual({ type: 'manual' });
    }
  });

  it('composes through compositor without error', () => {
    const scene = composeLayers(solarLayers, 'solar');

    expect(scene.id).toBe('solar');
    expect(scene.entities.length).toBeGreaterThan(0);
    // Should have entities from all visible layers
    expect(scene.entities.length).toBe(
      solarLayers
        .filter((l) => l.visible)
        .reduce((sum, l) => sum + l.entities.length, 0),
    );
  });

  it('sphere entity has animate callback after composition', () => {
    const scene = composeLayers(solarLayers, 'solar');
    const sphere = scene.entities.find((e) => e.id === 'orbiting:sphere');

    expect(sphere).toBeDefined();
    expect(sphere!.animate).toBeTypeOf('function');
  });

  it('floor entity has no animate callback', () => {
    const scene = composeLayers(solarLayers, 'solar');
    const floor = scene.entities.find((e) => e.id === 'ground:floor');

    expect(floor).toBeDefined();
    expect(floor!.animate).toBeUndefined();
  });

  it('has onThemeChange for sphere themeResponse', () => {
    const scene = composeLayers(solarLayers, 'solar');

    expect(scene.onThemeChange).toBeTypeOf('function');

    // Build mock entity with render.meshInstances[0].material
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

    // Should not throw when called with a dark theme
    scene.onThemeChange!('dark', {
      'orbiting:sphere': mockPcEntity,
    } as any);

    // Should have applied dark material overrides
    expect(mockMaterial.diffuse.set).toHaveBeenCalled();
    expect(mockMaterial.update).toHaveBeenCalled();
  });
});

describe('solarScene (backward-compat)', () => {
  it('exports a SceneContent with id and name', () => {
    expect(solarScene.id).toBe('solar');
    expect(solarScene.name).toBeTruthy();
  });

  it('has entities array', () => {
    expect(Array.isArray(solarScene.entities)).toBe(true);
    expect(solarScene.entities.length).toBeGreaterThan(0);
  });
});
