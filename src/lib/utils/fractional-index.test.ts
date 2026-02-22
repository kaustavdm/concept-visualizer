// src/lib/utils/fractional-index.test.ts
import { describe, it, expect } from 'vitest';
import {
  generatePosition,
  insertBetween,
  positionsForCount,
} from './fractional-index';

describe('fractional-index', () => {
  it('generatePosition returns a string', () => {
    const pos = generatePosition();
    expect(typeof pos).toBe('string');
    expect(pos.length).toBeGreaterThan(0);
  });

  it('insertBetween returns a string that sorts between a and b', () => {
    const a = 'a';
    const b = 'c';
    const mid = insertBetween(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('insertBetween with no lower bound sorts before upper', () => {
    const mid = insertBetween(undefined, 'b');
    expect(mid < 'b').toBe(true);
  });

  it('insertBetween with no upper bound sorts after lower', () => {
    const mid = insertBetween('b', undefined);
    expect(mid > 'b').toBe(true);
  });

  it('positionsForCount generates N sorted positions', () => {
    const positions = positionsForCount(5);
    expect(positions).toHaveLength(5);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] > positions[i - 1]).toBe(true);
    }
  });

  it('positionsForCount(0) returns empty array', () => {
    expect(positionsForCount(0)).toEqual([]);
  });
});
