import type { SceneContent } from '../scene-content.types';
import type { EntitySpec, Layer3d } from '../entity-spec';
import type { AnimationDSL } from '../animation-dsl';
import { composeLayers } from '../compositor';

/** Theme-specific sphere material colors */
const SPHERE_THEMES = {
  light: {
    diffuse: [0.23, 0.51, 0.96] as [number, number, number],
    emissive: [0.03, 0.06, 0.15] as [number, number, number],
    specular: [0.5, 0.6, 0.8] as [number, number, number],
  },
  dark: {
    diffuse: [0.25, 0.5, 1.0] as [number, number, number],
    emissive: [0.06, 0.1, 0.25] as [number, number, number],
    specular: [0.4, 0.5, 0.9] as [number, number, number],
  },
};

/** Blue sphere orbit around pyramid */
const SPHERE_ORBIT_RADIUS = 8;
const SPHERE_ORBIT_SPEED = 0.3; // radians/sec

/** Moon orbit parameters — 2.5x blue sphere visual radius (0.75) */
const BLUE_SPHERE_RADIUS = 0.75;
const MOON_ORBIT_RADIUS = BLUE_SPHERE_RADIUS * 2.5; // 1.875
const MOON_ORBIT_TILT = Math.PI / 4; // 45 degrees from grid plane
const MOON_ORBIT_SPEED = 0.6; // radians/sec

/** Pyramid position — center of the blue sphere's orbit */
const PYRAMID_POS: [number, number, number] = [0, 0, 0];

// --- Layer: ground (position 'a') — grid floor ---

const floorEntity: EntitySpec = {
  id: 'floor',
  components: { render: { type: 'plane', grid: { tiling: 4 } } },
  material: {
    diffuse: [0.5, 0.5, 0.55],
  },
  position: [0, -1, 0],
  scale: [80, 1, 80],
};

// --- Layer: structures (position 'n') — static pyramid ---

const pyramidEntity: EntitySpec = {
  id: 'pyramid',
  components: {
    render: {
      type: 'cone',
      geometry: {
        type: 'cone',
        capSegments: 4,
        baseRadius: 1,
        peakRadius: 0,
        height: 2,
        heightSegments: 1,
      },
    },
  },
  material: {
    diffuse: [0.76, 0.7, 0.5],
    emissive: [0.06, 0.05, 0.03],
    specular: [0.4, 0.35, 0.25],
    metalness: 0.1,
    gloss: 0.4,
  },
  position: PYRAMID_POS,
  rotation: [0, 45, 0],
};

// --- Layer: orbiting (position 'z') — sphere + moon ---

/**
 * Sphere animation: orbits origin at radius 8, speed 0.3 rad/s,
 * bobs with amplitude 0.25 at speed 0.8, rotates Y at 12 deg/s (~1/30 rev/s).
 *
 * Note: the original also had a subtle Z-axis wobble
 * (Math.sin(ctx.time * 0.5) * 5) which cannot be expressed in the
 * current rotate DSL (constant speed only). This is a minor
 * aesthetic loss.
 */
const sphereAnimation: AnimationDSL = [
  {
    type: 'orbit',
    radius: SPHERE_ORBIT_RADIUS,
    speed: SPHERE_ORBIT_SPEED,
    bob: { amplitude: 0.25, speed: 0.8 },
  },
  { type: 'rotate', axis: 'y', speed: 12 / 360 },
];

const sphereEntity: EntitySpec = {
  id: 'sphere',
  components: { render: { type: 'sphere' } },
  material: {
    diffuse: SPHERE_THEMES.light.diffuse,
    emissive: SPHERE_THEMES.light.emissive,
    specular: SPHERE_THEMES.light.specular,
    metalness: 0.3,
    gloss: 0.75,
  },
  scale: [1.5, 1.5, 1.5],
  followable: true,
  animate: sphereAnimation,
  themeResponse: {
    light: {
      diffuse: SPHERE_THEMES.light.diffuse,
      emissive: SPHERE_THEMES.light.emissive,
      specular: SPHERE_THEMES.light.specular,
    },
    dark: {
      diffuse: SPHERE_THEMES.dark.diffuse,
      emissive: SPHERE_THEMES.dark.emissive,
      specular: SPHERE_THEMES.dark.specular,
    },
  },
};

/**
 * Moon animation: orbits the sphere with a tilted orbit.
 *
 * Uses the namespaced entity ID 'orbiting:sphere' since the
 * compositor prefixes entity IDs with `${layerId}:${entityId}`.
 *
 * Note: the original used slightly elliptical orbit (semi-major 1.875,
 * semi-minor 1.65). The DSL orbit is circular, using radius 1.875.
 * This is a minor visual simplification (~12% difference in one axis).
 */
const moonAnimation: AnimationDSL = {
  type: 'orbit',
  center: 'orbiting:sphere',
  radius: MOON_ORBIT_RADIUS,
  speed: MOON_ORBIT_SPEED,
  tilt: MOON_ORBIT_TILT,
};

const moonEntity: EntitySpec = {
  id: 'moon',
  components: { render: { type: 'sphere' } },
  material: {
    diffuse: [0.75, 0.75, 0.78],
    emissive: [0.04, 0.04, 0.05],
    specular: [0.9, 0.9, 0.92],
    metalness: 0.6,
    gloss: 0.85,
  },
  scale: [0.15, 0.15, 0.15],
  followable: true,
  animate: moonAnimation,
};

// --- Compose layers ---

const now = new Date().toISOString();

export const solarLayers: Layer3d[] = [
  {
    id: 'ground',
    name: 'Ground',
    visible: true,
    text: '',
    entities: [floorEntity],
    position: 'a',
    source: { type: 'manual' },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'structures',
    name: 'Structures',
    visible: true,
    text: '',
    entities: [pyramidEntity],
    position: 'n',
    source: { type: 'manual' },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'orbiting',
    name: 'Orbiting Bodies',
    visible: true,
    text: '',
    entities: [sphereEntity, moonEntity],
    position: 'z',
    source: { type: 'manual' },
    createdAt: now,
    updatedAt: now,
  },
];

/** Backward-compatible SceneContent export — composed from layers */
export const solarScene: SceneContent = composeLayers(solarLayers, 'solar');
