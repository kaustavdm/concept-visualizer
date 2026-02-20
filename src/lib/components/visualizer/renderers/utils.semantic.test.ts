import { describe, it, expect } from 'vitest';
import { logicalRoleColor, edgeSemanticColor } from './utils';

describe('logicalRoleColor', () => {
  const roles = ['premise', 'evidence', 'inference', 'conclusion', 'objection'] as const;

  roles.forEach(role => {
    it(`returns a hex color for "${role}" in light mode`, () => {
      expect(logicalRoleColor(role, false)).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it(`returns a hex color for "${role}" in dark mode`, () => {
      expect(logicalRoleColor(role, true)).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it(`light and dark differ for "${role}"`, () => {
      expect(logicalRoleColor(role, false)).not.toBe(logicalRoleColor(role, true));
    });
  });

  it('falls back for undefined role', () => {
    expect(logicalRoleColor(undefined, false)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('edgeSemanticColor', () => {
  ['supports', 'contradicts', 'derives', 'qualifies'].forEach(type => {
    it(`returns a non-empty string for "${type}" light`, () => {
      expect(edgeSemanticColor(type, false)).toBeTruthy();
    });
    it(`returns a non-empty string for "${type}" dark`, () => {
      expect(edgeSemanticColor(type, true)).toBeTruthy();
    });
    it(`light and dark differ for "${type}"`, () => {
      expect(edgeSemanticColor(type, false)).not.toBe(edgeSemanticColor(type, true));
    });
  });

  it('falls back to CSS var for unknown type', () => {
    expect(edgeSemanticColor('unknown', false)).toBe('var(--viz-edge)');
  });

  it('falls back to CSS var for undefined', () => {
    expect(edgeSemanticColor(undefined, false)).toBe('var(--viz-edge)');
  });
});
