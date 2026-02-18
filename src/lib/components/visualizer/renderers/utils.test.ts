import { describe, it, expect } from 'vitest';
import {
  themeColor,
  themeColorForMode,
  THEME_COLORS,
  THEME_COLORS_LIGHT,
  THEME_COLORS_DARK,
  nodeRadius,
  edgeThickness,
  edgeOpacity,
  truncate,
} from './utils';

describe('themeColor', () => {
  it('returns first palette color when theme is undefined', () => {
    expect(themeColor(undefined)).toBe(THEME_COLORS[0]);
  });

  it('returns a color from the palette for any string', () => {
    const color = themeColor('process');
    expect(THEME_COLORS).toContain(color);
  });

  it('returns the same color for the same input (deterministic)', () => {
    expect(themeColor('emotion')).toBe(themeColor('emotion'));
  });

});

describe('THEME_COLORS_LIGHT and THEME_COLORS_DARK', () => {
  it('THEME_COLORS is an alias for THEME_COLORS_LIGHT', () => {
    expect(THEME_COLORS).toBe(THEME_COLORS_LIGHT);
  });

  it('THEME_COLORS_DARK is a non-empty array of hex strings', () => {
    expect(THEME_COLORS_DARK.length).toBeGreaterThan(0);
    for (const c of THEME_COLORS_DARK) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('light and dark palettes have the same number of entries', () => {
    expect(THEME_COLORS_LIGHT.length).toBe(THEME_COLORS_DARK.length);
  });

  it('light palette colors differ from dark palette colors', () => {
    // At least some colors should differ — the palettes are not identical
    const same = THEME_COLORS_LIGHT.every((c, i) => c === THEME_COLORS_DARK[i]);
    expect(same).toBe(false);
  });
});

describe('themeColorForMode', () => {
  it('returns a light-palette color when isDark is false', () => {
    const color = themeColorForMode('process', false);
    expect(THEME_COLORS_LIGHT).toContain(color);
  });

  it('returns a dark-palette color when isDark is true', () => {
    const color = themeColorForMode('process', true);
    expect(THEME_COLORS_DARK).toContain(color);
  });

  it('is deterministic for the same key and mode', () => {
    expect(themeColorForMode('emotion', false)).toBe(themeColorForMode('emotion', false));
    expect(themeColorForMode('emotion', true)).toBe(themeColorForMode('emotion', true));
  });

  it('maps the same key to the same palette index in both modes', () => {
    const lightIdx = THEME_COLORS_LIGHT.indexOf(themeColorForMode('concept', false));
    const darkIdx  = THEME_COLORS_DARK.indexOf(themeColorForMode('concept', true));
    expect(lightIdx).toBe(darkIdx);
  });

  it('returns first dark-palette color when theme is undefined and isDark is true', () => {
    expect(themeColorForMode(undefined, true)).toBe(THEME_COLORS_DARK[0]);
  });

});

describe('nodeRadius', () => {
  it('returns 12 for weight 0', () => {
    expect(nodeRadius(0)).toBe(12);
  });

  it('returns 40 for weight 1', () => {
    expect(nodeRadius(1)).toBe(40);
  });

  it('returns 26 for undefined (default 0.5)', () => {
    expect(nodeRadius(undefined)).toBe(26);
  });

  it('clamps correctly between 12 and 40', () => {
    expect(nodeRadius(0.5)).toBeGreaterThanOrEqual(12);
    expect(nodeRadius(0.5)).toBeLessThanOrEqual(40);
  });
});

describe('edgeThickness', () => {
  it('returns 1 for strength 0', () => {
    expect(edgeThickness(0)).toBe(1);
  });

  it('returns 4 for strength 1', () => {
    expect(edgeThickness(1)).toBe(4);
  });

  it('returns 2.5 for undefined (default 0.5)', () => {
    expect(edgeThickness(undefined)).toBeCloseTo(2.5);
  });
});

describe('edgeOpacity', () => {
  it('returns 0.4 for strength 0', () => {
    expect(edgeOpacity(0)).toBeCloseTo(0.4);
  });

  it('returns 0.9 for strength 1', () => {
    expect(edgeOpacity(1)).toBeCloseTo(0.9);
  });
});

describe('truncate', () => {
  it('returns empty string for undefined input', () => {
    expect(truncate(undefined, 20)).toBe('');
  });

  it('truncates strings longer than max with ellipsis', () => {
    const result = truncate('hello world foo bar baz', 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns unchanged string when shorter than max', () => {
    expect(truncate('hello', 20)).toBe('hello');
  });
});
