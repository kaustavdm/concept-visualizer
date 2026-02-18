/**
 * Renderer utility functions — palette, sizing, and string helpers.
 *
 * Two palettes are provided so nodes remain legible on both the light canvas
 * (#f9fafb) and the dark canvas (#030712) defined in app.css:
 *
 *   THEME_COLORS_LIGHT — mid-saturation hues that stand out on near-white.
 *   THEME_COLORS_DARK  — brighter/lighter tints of the same hue family that
 *                        read clearly against near-black without blooming.
 *
 * Both palettes have the same length so a single hash index selects the
 * conceptually matching color in each mode (same position = same semantic hue).
 *
 * THEME_COLORS is an alias for THEME_COLORS_LIGHT to keep backward compat.
 */

// Light-mode palette — mid-saturation, readable on #f9fafb canvas.
export const THEME_COLORS_LIGHT = [
  '#4a7fc1', // Slate Blue
  '#3a9e7e', // Sage Green
  '#c95f5f', // Coral Rose
  '#b8832a', // Warm Amber
  '#7a55b8', // Lavender
  '#2e8fa0', // Teal
  '#9a7a45', // Sand
];

// Dark-mode palette — brighter tints of the same hue family, readable on #030712 canvas.
export const THEME_COLORS_DARK = [
  '#93b8e8', // Slate Blue (lighter)
  '#6fd4b0', // Sage Green (lighter)
  '#f49898', // Coral Rose (lighter)
  '#f0bf72', // Warm Amber (lighter)
  '#c09cf5', // Lavender (lighter)
  '#6fd0e0', // Teal (lighter)
  '#d4b882', // Sand (lighter)
];

// Backward-compatible alias — callers that only need one palette use this.
export const THEME_COLORS = THEME_COLORS_LIGHT;

/** Shared hash: maps a string key to a palette index. */
function paletteIndex(key: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  }
  return hash % length;
}

/**
 * Deterministically map a theme string to a light-mode palette color.
 * Falls back to `fallback` group key when theme is undefined.
 * Falls back to the first palette color when both are absent.
 */
export function themeColor(theme: string | undefined, fallback?: string): string {
  const key = theme ?? fallback ?? '';
  if (!key) return THEME_COLORS_LIGHT[0];
  return THEME_COLORS_LIGHT[paletteIndex(key, THEME_COLORS_LIGHT.length)];
}

/**
 * Mode-aware color lookup.
 * Selects from THEME_COLORS_DARK when `isDark` is true, THEME_COLORS_LIGHT
 * otherwise. The same key always maps to the same palette index in both modes,
 * so the semantic hue family is preserved across themes.
 */
export function themeColorForMode(
  theme: string | undefined,
  isDark: boolean,
  fallback?: string
): string {
  const palette = isDark ? THEME_COLORS_DARK : THEME_COLORS_LIGHT;
  const key = theme ?? fallback ?? '';
  if (!key) return palette[0];
  return palette[paletteIndex(key, palette.length)];
}

/** Node radius from weight (0–1). Returns 12–40 px range. */
export function nodeRadius(weight: number | undefined): number {
  return 12 + (weight ?? 0.5) * 28;
}

/** Edge stroke width from strength (0–1). Returns 1–4 px range. */
export function edgeThickness(strength: number | undefined): number {
  return 1 + (strength ?? 0.5) * 3;
}

/** Edge opacity from strength (0–1). Returns 0.4–0.9 range. */
export function edgeOpacity(strength: number | undefined): number {
  return 0.4 + (strength ?? 0.5) * 0.5;
}

/** Truncate a string to max characters, appending an ellipsis character. */
export function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/** Darken a hex color by a factor (0–1). */
export function darkenColor(hex: string, amount = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/** Hex color to rgba string. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
