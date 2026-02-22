import { describe, it, expect, vi } from 'vitest';
import { resolveAnimation, type AnimationDSL } from './animation-dsl';
import type { AnimationContext } from './scene-content.types';

/** Create a mock entity with vi.fn() stubs for PlayCanvas Entity methods */
function mockEntity(pos = { x: 0, y: 0, z: 0 }) {
  return {
    setPosition: vi.fn(),
    setLocalEulerAngles: vi.fn(),
    getPosition: vi.fn(() => ({ x: pos.x, y: pos.y, z: pos.z })),
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
    const dsl: AnimationDSL = { type: 'rotate', axis: 'y', speed: 90 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // speed=90 deg/s * time=1s = 90 degrees around Y
    expect(entity.setLocalEulerAngles).toHaveBeenCalledWith(0, 90, 0);
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

  it('array DSL — runs all animations (both setPosition and setLocalEulerAngles called)', () => {
    const dsl: AnimationDSL = [
      { type: 'bob', amplitude: 1, speed: 1 },
      { type: 'rotate', axis: 'y', speed: 45 },
    ];
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // bob sets position, rotate sets euler angles — both should be called
    expect(entity.setPosition).toHaveBeenCalled();
    expect(entity.setLocalEulerAngles).toHaveBeenCalled();
    // Verify rotate values: 45 deg/s * 1s = 45
    expect(entity.setLocalEulerAngles).toHaveBeenCalledWith(0, 45, 0);
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
    const dsl: AnimationDSL = { type: 'rotate', axis: 'x', speed: 180 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(0.5);

    fn(entity as any, ctx);

    // speed=180 deg/s * time=0.5s = 90 degrees around X
    expect(entity.setLocalEulerAngles).toHaveBeenCalledWith(90, 0, 0);
  });

  it('rotate around Z axis', () => {
    const dsl: AnimationDSL = { type: 'rotate', axis: 'z', speed: 360 };
    const fn = resolveAnimation(dsl);
    const entity = mockEntity();
    const ctx = makeCtx(1);

    fn(entity as any, ctx);

    // speed=360 deg/s * time=1s = 360 degrees around Z
    expect(entity.setLocalEulerAngles).toHaveBeenCalledWith(0, 0, 360);
  });
});
