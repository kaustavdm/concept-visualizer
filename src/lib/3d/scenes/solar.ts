import type { SceneContent } from '../scene-content.types';
import * as pc from 'playcanvas';

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
const SPHERE_ORBIT_RADIUS = 8; // near-circular orbit around pyramid at (10,0,0)
const SPHERE_ORBIT_SPEED = 0.3; // radians/sec (~21s per revolution)

/** Moon orbit parameters — 2.5× blue sphere visual radius (0.75) */
const BLUE_SPHERE_RADIUS = 0.75; // half of scale 1.5
const MOON_ORBIT_A = BLUE_SPHERE_RADIUS * 2.5; // 1.875 semi-major
const MOON_ORBIT_B = BLUE_SPHERE_RADIUS * 2.2; // slightly elliptical
const MOON_ORBIT_TILT = Math.PI / 4; // 45 degrees from grid plane

/** Pyramid position — center of the blue sphere's orbit */
const PYRAMID_POS: [number, number, number] = [0, 0, 0];

export const solarScene: SceneContent = {
  id: 'solar',
  name: 'Solar System',

  entities: [
    // Blue sphere — orbits around pyramid, continues to bob
    {
      id: 'sphere',
      mesh: 'sphere',
      material: {
        diffuse: SPHERE_THEMES.light.diffuse,
        emissive: SPHERE_THEMES.light.emissive,
        specular: SPHERE_THEMES.light.specular,
        metalness: 0.3,
        gloss: 0.75,
      },
      scale: [1.5, 1.5, 1.5],
      followable: true,
      animate: (entity, ctx) => {
        const bobY = Math.sin(ctx.time * 0.8) * 0.25;
        const angle = ctx.time * SPHERE_ORBIT_SPEED;
        const x = PYRAMID_POS[0] + Math.cos(angle) * SPHERE_ORBIT_RADIUS;
        const z = PYRAMID_POS[2] + Math.sin(angle) * SPHERE_ORBIT_RADIUS;
        entity.setPosition(x, bobY, z);
        entity.setLocalEulerAngles(
          0,
          ctx.time * 12,
          Math.sin(ctx.time * 0.5) * 5,
        );
      },
    },

    // Sandy pyramid — static at center
    {
      id: 'pyramid',
      mesh: {
        type: 'cone',
        capSegments: 4,
        baseRadius: 1,
        peakRadius: 0,
        height: 2,
        heightSegments: 1,
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
    },

    // Silver moon — orbits blue sphere with tighter orbit
    {
      id: 'moon',
      mesh: 'sphere',
      material: {
        diffuse: [0.75, 0.75, 0.78],
        emissive: [0.04, 0.04, 0.05],
        specular: [0.9, 0.9, 0.92],
        metalness: 0.6,
        gloss: 0.85,
      },
      scale: [0.15, 0.15, 0.15],
      followable: true,
      animate: (entity, ctx) => {
        const sphere = ctx.entities['sphere'];
        const spherePos = sphere?.getPosition();
        const sphereX = spherePos?.x ?? 0;
        const sphereY = spherePos?.y ?? 0;
        const sphereZ = spherePos?.z ?? 0;
        const angle = ctx.time * 0.6; // ~10s per revolution
        const moonX = Math.cos(angle) * MOON_ORBIT_A;
        const moonY = Math.sin(angle) * MOON_ORBIT_B * Math.sin(MOON_ORBIT_TILT);
        const moonZ = Math.sin(angle) * MOON_ORBIT_B * Math.cos(MOON_ORBIT_TILT);
        entity.setPosition(
          sphereX + moonX,
          sphereY + moonY,
          sphereZ + moonZ,
        );
      },
    },

    // Grid floor — transparent grid pattern
    {
      id: 'floor',
      mesh: 'plane',
      material: {
        diffuse: [0.5, 0.5, 0.55],
      },
      position: [0, -1, 0],
      scale: [80, 1, 80],
      opacity: { map: 'grid', tiling: 4, blend: true },
    },
  ],

  onThemeChange: (theme, entities) => {
    const sphereEntity = entities['sphere'];
    if (!sphereEntity?.render) return;
    const mat = sphereEntity.render.meshInstances[0]
      .material as pc.StandardMaterial;
    const colors = SPHERE_THEMES[theme];
    mat.diffuse.set(colors.diffuse[0], colors.diffuse[1], colors.diffuse[2]);
    mat.emissive.set(
      colors.emissive[0],
      colors.emissive[1],
      colors.emissive[2],
    );
    mat.specular.set(
      colors.specular[0],
      colors.specular[1],
      colors.specular[2],
    );
    mat.update();
  },
};
