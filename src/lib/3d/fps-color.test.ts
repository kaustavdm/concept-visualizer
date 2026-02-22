import { describe, it, expect } from 'vitest';
import { fpsToColor } from './fps-color.js';

describe('fpsToColor', () => {
	it('returns dull red for very low FPS', () => {
		const result = fpsToColor(5);
		expect(result.color).toMatch(/^hsl\(/);
		expect(result.glow).toBe(false);
	});

	it('returns yellow-ish for 24-30 FPS', () => {
		const result = fpsToColor(27);
		expect(result.color).toMatch(/^hsl\(/);
		expect(result.glow).toBe(false);
	});

	it('returns green for 60 FPS', () => {
		const result = fpsToColor(60);
		expect(result.color).toMatch(/^hsl\(/);
		expect(result.glow).toBe(false);
	});

	it('returns green with glow for 90+ FPS', () => {
		const result = fpsToColor(120);
		expect(result.glow).toBe(true);
	});

	it('clamps at 0 FPS', () => {
		const result = fpsToColor(0);
		expect(result.color).toMatch(/^hsl\(/);
	});
});
