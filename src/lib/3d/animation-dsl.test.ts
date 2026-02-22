import { describe, it, expect, vi } from 'vitest';
import { resolveAnimation, type AnimationDSL } from './animation-dsl';
import type { AnimationContext } from './scene-content.types';

/** Create a mock entity with vi.fn() stubs for PlayCanvas Entity methods */
function mockEntity(pos = { x: 0, y: 0, z: 0 }, rot = { x: 0, y: 0, z: 0 }) {
  return {
    setPosition: vi.fn(),
    setLocalEulerAngles: vi.fn(),
    setEulerAngles: vi.fn(),
    setLocalScale: vi.fn(),
    getPosition: vi.fn(() => ({ x: pos.x, y: pos.y, z: pos.z })),
    getEulerAngles: vi.fn(() => ({ x: rot.x, y: rot.y, z: rot.z })),
    lookAt: vi.fn(),
  };
}

/** Create an AnimationContext with given time and optional named entities */
function makeCtx(
  time: number,
  entities: Record<string, ReturnType<typeof mockEntity>> = {},
): AnimationContext {
  return { time, dt: 1 / 60, entities: entities as unknown as AnimationContext['entities'] };
}

describe('resolveAnimation', () => {
  it('rotate — spins entity around Y axis', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'y', speed: 0.25 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // speed=0.25 rev/s * time=1s * 360 = 90 degrees around Y (base rotation is 0)
    expect(entity.setEulerAngles).toHaveBeenCalledWith(0, 90, 0);
  });

  it('bob — oscillates on Y axis', () => {
    const dsl: AnimationDSL = { type: 'bob', amplitude: 2, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    // At time = PI/2, sin(PI/2 * 1) * 2 = 2
    const ctx = makeCtx(Math.PI / 2);

    fn(entity as any, ctx);

    expect(entity.setPosition).toHaveBeenCalledTimes(1);
    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(2, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('orbit — circular path around origin', () => {
    const dsl: AnimationDSL = { type: 'orbit', radius: 5, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    // At time=0, angle=0, cos(0)*5=5, sin(0)*5=0
    const ctx = makeCtx(0);

    fn(entity as any, ctx);

    expect(entity.setPosition).toHaveBeenCalledTimes(1);
    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(5, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('orbit with center entity — orbits around another entity', () => {
    const dsl: AnimationDSL = { type: 'orbit', center: 'hub', radius: 3, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const hub = mockEntity({ x: 10, y: 0, z: 10 });
    // At time=0, angle=0: x = 10 + cos(0)*3 = 13, z = 10 + sin(0)*3 = 10
    const ctx = makeCtx(0, { hub });

    fn(entity as any, ctx);

    expect(entity.setPosition).toHaveBeenCalledTimes(1);
    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(13, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(10, 5);
  });

  it('orbit with bob — orbit + vertical oscillation combined', () => {
    const dsl: AnimationDSL = {
      type: 'orbit',
      radius: 5,
      speed: 1,
      bob: { amplitude: 2, speed: 1 },
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    // At time=PI/2: orbit x=cos(PI/2)*5~=0, z=sin(PI/2)*5~=5
    // bob y = sin(PI/2 * 1) * 2 = 2
    const ctx = makeCtx(Math.PI / 2);

    fn(entity as any, ctx);

    expect(entity.setPosition).toHaveBeenCalledTimes(1);
    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(2, 3);
    expect(z).toBeCloseTo(5, 3);
  });

  it('array DSL — runs all animations (both setPosition and setEulerAngles called)', () => {
    const dsl: AnimationDSL = [
      { type: 'bob', amplitude: 1, speed: 1 },
      { type: 'rotate', axis: 'y', speed: 0.125 },
    ];
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // bob sets position, rotate sets euler angles — both should be called
    expect(entity.setPosition).toHaveBeenCalled();
    expect(entity.setEulerAngles).toHaveBeenCalled();
    // Verify rotate values: 0.125 rev/s * 1s * 360 = 45 degrees (base rotation is 0)
    expect(entity.setEulerAngles).toHaveBeenCalledWith(0, 45, 0);
    // Verify bob values: sin(1 * 1) * 1
    const [, y] = entity.setPosition.mock.calls[0];
    expect(y).toBeCloseTo(Math.sin(1), 5);
  });

  it('path DSL — interpolates between waypoints', () => {
    const dsl: AnimationDSL = {
      type: 'path',
      points: [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
      ],
      speed: 1,
      loop: true,
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();

    // Total path length: segment 0->1 = 10, segment 1->2 = 10, total = 20
    // speed=1 means 1 unit/sec traversal
    // At time=0 -> start of path -> (0,0,0)
    fn(entity as any, makeCtx(0));
    {
      const [x, y, z] = entity.setPosition.mock.calls[0];
      expect(x).toBeCloseTo(0, 3);
      expect(y).toBeCloseTo(0, 3);
      expect(z).toBeCloseTo(0, 3);
    }

    entity.setPosition.mockClear();

    // At time=5, distance = 5 units along path -> midway through first segment -> (5, 0, 0)
    fn(entity as any, makeCtx(5));
    {
      const [x, y, z] = entity.setPosition.mock.calls[0];
      expect(x).toBeCloseTo(5, 3);
      expect(y).toBeCloseTo(0, 3);
      expect(z).toBeCloseTo(0, 3);
    }

    entity.setPosition.mockClear();

    // At time=15, distance = 15 -> 10 into first segment + 5 into second -> (10, 0, 5)
    fn(entity as any, makeCtx(15));
    {
      const [x, y, z] = entity.setPosition.mock.calls[0];
      expect(x).toBeCloseTo(10, 3);
      expect(y).toBeCloseTo(0, 3);
      expect(z).toBeCloseTo(5, 3);
    }

    entity.setPosition.mockClear();

    // At time=20, distance = 20 -> end of path, but loop wraps to start -> (0, 0, 0)
    fn(entity as any, makeCtx(20));
    {
      const [x, y, z] = entity.setPosition.mock.calls[0];
      expect(x).toBeCloseTo(0, 3);
      expect(y).toBeCloseTo(0, 3);
      expect(z).toBeCloseTo(0, 3);
    }
  });

  it('path DSL without loop — clamps at final point', () => {
    const dsl: AnimationDSL = {
      type: 'path',
      points: [
        [0, 0, 0],
        [10, 0, 0],
      ],
      speed: 1,
      loop: false,
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();

    // At time=20, distance=20 but path is only 10 long, no loop -> clamp to end
    fn(entity as any, makeCtx(20));
    {
      const [x, y, z] = entity.setPosition.mock.calls[0];
      expect(x).toBeCloseTo(10, 3);
      expect(y).toBeCloseTo(0, 3);
      expect(z).toBeCloseTo(0, 3);
    }
  });

  it('orbit with tilt — tilts the orbit plane', () => {
    const dsl: AnimationDSL = {
      type: 'orbit',
      radius: 5,
      speed: 1,
      tilt: Math.PI / 4, // 45 degrees
    };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    // At time=PI/2: angle=PI/2
    // x = cos(PI/2) * 5 ~= 0
    // z_flat = sin(PI/2) * 5 = 5
    // y = z_flat * sin(tilt) = 5 * sin(PI/4) = 5 * ~0.7071 ~= 3.5355
    // z = z_flat * cos(tilt) = 5 * cos(PI/4) = 5 * ~0.7071 ~= 3.5355
    const ctx = makeCtx(Math.PI / 2);

    fn(entity as any, ctx);

    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeCloseTo(5 * Math.sin(Math.PI / 4), 3);
    expect(z).toBeCloseTo(5 * Math.cos(Math.PI / 4), 3);
  });

  it('rotate around X axis', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'x', speed: 0.5 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(0.5);

    fn(entity as any, ctx);

    // speed=0.5 rev/s * time=0.5s * 360 = 90 degrees around X (base rotation is 0)
    expect(entity.setEulerAngles).toHaveBeenCalledWith(90, 0, 0);
  });

  it('rotate around Z axis', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'z', speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // speed=1 rev/s * time=1s * 360 = 360 degrees around Z (base rotation is 0)
    expect(entity.setEulerAngles).toHaveBeenCalledWith(0, 0, 360);
  });

  // --- Bug fix tests ---

  it('bob — preserves entity X/Z position', () => {
    const dsl: AnimationDSL = { type: 'bob', amplitude: 2, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity({ x: 5, y: 0, z: 3 });
    const ctx = makeCtx(Math.PI / 2);

    fn(entity as any, ctx);

    const [x, y, z] = entity.setPosition.mock.calls[0];
    expect(x).toBeCloseTo(5, 5); // X preserved
    expect(z).toBeCloseTo(3, 5); // Z preserved
    expect(y).toBeCloseTo(2, 1); // bob applied to Y
  });

  it('bob — stores initial Y and does not accumulate offset', () => {
    const dsl: AnimationDSL = { type: 'bob', amplitude: 2, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity({ x: 1, y: 10, z: 2 });

    // First frame
    fn(entity as any, makeCtx(Math.PI / 2));
    const [, y1] = entity.setPosition.mock.calls[0];
    expect(y1).toBeCloseTo(12, 1); // baseY=10 + sin(PI/2)*2 = 12

    // Second frame — getPosition would return the *set* position, but baseY is locked
    // Simulate entity returning updated position (as if setPosition took effect)
    entity.getPosition.mockReturnValue({ x: 1, y: 12, z: 2 });
    entity.setPosition.mockClear();

    fn(entity as any, makeCtx(0));
    const [, y2] = entity.setPosition.mock.calls[0];
    // baseY was captured as 10 on first call, sin(0)*2 = 0 -> y = 10
    expect(y2).toBeCloseTo(10, 1);
  });

  it('rotate — preserves initial rotation offset', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'y', speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 });
    const ctx = makeCtx(0.5);

    fn(entity as any, ctx);

    const [rx, ry, rz] = entity.setEulerAngles.mock.calls[0];
    expect(rx).toBe(10); // X preserved
    expect(rz).toBe(30); // Z preserved
    expect(ry).toBe(20 + 0.5 * 360); // Y = base + time*speed*360
  });

  // --- New animation types ---

  it('scale — oscillates between min and max', () => {
    const dsl: AnimationDSL = { type: 'scale', min: 0.5, max: 2.0, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();

    fn(entity as any, makeCtx(0));
    const [s0] = entity.setLocalScale.mock.calls[0];
    expect(s0).toBeGreaterThanOrEqual(0.5);
    expect(s0).toBeLessThanOrEqual(2.0);
  });

  it('scale — at time producing sin=1, scale is max', () => {
    const dsl: AnimationDSL = { type: 'scale', min: 0.5, max: 2.0, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();

    // At time = PI/2, sin(PI/2) = 1, t = (1+1)/2 = 1, scale = 0.5 + 1*(2-0.5) = 2.0
    fn(entity as any, makeCtx(Math.PI / 2));
    const [s] = entity.setLocalScale.mock.calls[0];
    expect(s).toBeCloseTo(2.0, 5);
  });

  it('scale — at time producing sin=-1, scale is min', () => {
    const dsl: AnimationDSL = { type: 'scale', min: 0.5, max: 2.0, speed: 1 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();

    // At time = 3*PI/2, sin(3*PI/2) = -1, t = (-1+1)/2 = 0, scale = 0.5
    fn(entity as any, makeCtx((3 * Math.PI) / 2));
    const [s] = entity.setLocalScale.mock.calls[0];
    expect(s).toBeCloseTo(0.5, 5);
  });

  it('lookat — faces target entity', () => {
    const dsl: AnimationDSL = { type: 'lookat', target: 'sun' };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(0);
    const sun = mockEntity({ x: 10, y: 5, z: 0 });
    ctx.entities = { sun } as unknown as AnimationContext['entities'];

    fn(entity as any, ctx);

    expect(entity.lookAt).toHaveBeenCalled();
    const calledWith = entity.lookAt.mock.calls[0][0];
    expect(calledWith.x).toBe(10);
    expect(calledWith.y).toBe(5);
    expect(calledWith.z).toBe(0);
  });

  it('lookat — does nothing when target not found', () => {
    const dsl: AnimationDSL = { type: 'lookat', target: 'missing' };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(0);
    ctx.entities = {} as unknown as AnimationContext['entities'];

    fn(entity as any, ctx);

    expect(entity.lookAt).not.toHaveBeenCalled();
  });
});
