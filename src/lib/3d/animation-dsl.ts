import type * as pc from 'playcanvas';
import type { AnimationContext } from './scene-content.types';

// --- Animation DSL types ---

export interface OrbitAnimation {
  type: 'orbit';
  /** Entity ID to orbit around (defaults to world origin) */
  center?: string;
  /** Orbit radius in world units */
  radius: number;
  /** Angular speed in radians per second */
  speed: number;
  /** Tilt angle in radians — tilts orbit plane from the XZ plane */
  tilt?: number;
  /** Optional vertical bob while orbiting */
  bob?: { amplitude: number; speed: number };
}

export interface RotateAnimation {
  type: 'rotate';
  /** Axis to rotate around */
  axis: 'x' | 'y' | 'z';
  /** Rotation speed in revolutions per second */
  speed: number;
}

export interface BobAnimation {
  type: 'bob';
  /** Vertical oscillation amplitude in world units */
  amplitude: number;
  /** Oscillation frequency multiplier (1 = one full cycle every 2*PI seconds) */
  speed: number;
}

export interface ScaleAnimation {
  type: 'scale';
  /** Minimum scale factor */
  min: number;
  /** Maximum scale factor */
  max: number;
  /** Oscillation speed */
  speed: number;
}

export interface LookAtAnimation {
  type: 'lookat';
  /** Entity ID to face */
  target: string;
}

export interface PathAnimation {
  type: 'path';
  /** Waypoints as [x, y, z] tuples */
  points: [number, number, number][];
  /** Movement speed in world units per second */
  speed: number;
  /** Whether to loop back to start after reaching the end */
  loop: boolean;
}

export type AnimationDSL =
  | OrbitAnimation
  | RotateAnimation
  | BobAnimation
  | PathAnimation
  | ScaleAnimation
  | LookAtAnimation
  | AnimationDSL[];

// --- Resolver ---

type AnimateFn = (entity: pc.Entity, ctx: AnimationContext) => void;

function resolveRotate(dsl: RotateAnimation): AnimateFn {
  let baseRotation: { x: number; y: number; z: number } | null = null;
  return (entity, ctx) => {
    const euler = entity.getEulerAngles();
    if (baseRotation === null) {
      baseRotation = { x: euler.x, y: euler.y, z: euler.z };
    }
    const angle = ctx.time * dsl.speed * 360;
    entity.setEulerAngles(
      baseRotation.x + (dsl.axis === 'x' ? angle : 0),
      baseRotation.y + (dsl.axis === 'y' ? angle : 0),
      baseRotation.z + (dsl.axis === 'z' ? angle : 0),
    );
  };
}

function resolveBob(dsl: BobAnimation): AnimateFn {
  let baseY: number | null = null;
  return (entity, ctx) => {
    const pos = entity.getPosition();
    if (baseY === null) baseY = pos.y;
    const y = baseY + Math.sin(ctx.time * dsl.speed) * dsl.amplitude;
    entity.setPosition(pos.x, y, pos.z);
  };
}

function resolveOrbit(dsl: OrbitAnimation): AnimateFn {
  return (entity, ctx) => {
    const angle = ctx.time * dsl.speed;
    const tilt = dsl.tilt ?? 0;

    // Center position (origin or named entity)
    let cx = 0;
    let cy = 0;
    let cz = 0;
    if (dsl.center) {
      const centerEntity = ctx.entities[dsl.center];
      if (centerEntity) {
        const pos = centerEntity.getPosition();
        cx = pos.x;
        cy = pos.y;
        cz = pos.z;
      }
    }

    // Compute orbit position in XZ plane, then tilt
    const flatX = Math.cos(angle) * dsl.radius;
    const flatZ = Math.sin(angle) * dsl.radius;

    // Tilt rotates the Z component into Y
    const x = cx + flatX;
    const y = cy + flatZ * Math.sin(tilt);
    const z = cz + flatZ * Math.cos(tilt);

    // Optional bob adds to Y
    let bobY = 0;
    if (dsl.bob) {
      bobY = Math.sin(ctx.time * dsl.bob.speed) * dsl.bob.amplitude;
    }

    entity.setPosition(x, y + bobY, z);
  };
}

/**
 * Pre-compute cumulative segment lengths for a path.
 * Returns an array where lengths[i] is the cumulative distance from point 0 to point i.
 */
function computePathLengths(points: [number, number, number][]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const dz = points[i][2] - points[i - 1][2];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
  }
  return lengths;
}

function resolvePath(dsl: PathAnimation): AnimateFn {
  const points = dsl.points;
  if (points.length === 0) {
    return () => {};
  }
  if (points.length === 1) {
    return (entity) => {
      entity.setPosition(points[0][0], points[0][1], points[0][2]);
    };
  }

  const lengths = computePathLengths(points);
  const totalLength = lengths[lengths.length - 1];

  return (entity, ctx) => {
    let distance = ctx.time * dsl.speed;

    if (dsl.loop) {
      // Wrap distance within total path length
      distance = ((distance % totalLength) + totalLength) % totalLength;
    } else {
      // Clamp to path length
      distance = Math.min(distance, totalLength);
    }

    // Find the segment that contains this distance
    let segIdx = 0;
    for (let i = 1; i < lengths.length; i++) {
      if (lengths[i] >= distance) {
        segIdx = i - 1;
        break;
      }
    }

    const segStart = lengths[segIdx];
    const segEnd = lengths[segIdx + 1];
    const segLength = segEnd - segStart;

    // Interpolation factor within the segment
    const t = segLength > 0 ? (distance - segStart) / segLength : 0;

    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];

    const x = p0[0] + (p1[0] - p0[0]) * t;
    const y = p0[1] + (p1[1] - p0[1]) * t;
    const z = p0[2] + (p1[2] - p0[2]) * t;

    entity.setPosition(x, y, z);
  };
}

function resolveScale(dsl: ScaleAnimation): AnimateFn {
  return (entity, ctx) => {
    const t = (Math.sin(ctx.time * dsl.speed) + 1) / 2; // 0-1 oscillation
    const s = dsl.min + t * (dsl.max - dsl.min);
    entity.setLocalScale(s, s, s);
  };
}

function resolveLookAt(dsl: LookAtAnimation): AnimateFn {
  return (entity, ctx) => {
    const target = ctx.entities[dsl.target];
    if (target) {
      entity.lookAt(target.getPosition());
    }
  };
}

/**
 * Convert a declarative AnimationDSL config into a callback function
 * compatible with SceneEntitySpec.animate.
 *
 * Array DSL composes multiple animations — each runs on the entity per frame.
 */
export function resolveAnimation(dsl: AnimationDSL): AnimateFn {
  // Array composition: resolve each, run all per frame
  if (Array.isArray(dsl)) {
    const fns = dsl.map((d) => resolveAnimation(d));
    return (entity, ctx) => {
      for (const fn of fns) {
        fn(entity, ctx);
      }
    };
  }

  switch (dsl.type) {
    case 'rotate':
      return resolveRotate(dsl);
    case 'bob':
      return resolveBob(dsl);
    case 'orbit':
      return resolveOrbit(dsl);
    case 'path':
      return resolvePath(dsl);
    case 'scale':
      return resolveScale(dsl);
    case 'lookat':
      return resolveLookAt(dsl);
  }
}
