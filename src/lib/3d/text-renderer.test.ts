// src/lib/3d/text-renderer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTextCanvas, clearTextCache } from './text-renderer';

describe('createTextCanvas', () => {
	beforeEach(() => {
		clearTextCache();
	});

	it('creates a canvas with text content', () => {
		const canvas = createTextCanvas({
			text: 'Hello World',
			fontSize: 36,
			color: [1, 1, 1],
		});
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(canvas.width).toBeGreaterThan(0);
		expect(canvas.height).toBeGreaterThan(0);
	});

	it('applies background when specified', () => {
		const canvas = createTextCanvas({
			text: 'Tablet',
			fontSize: 32,
			color: [0.9, 0.85, 0.7],
			background: [0.15, 0.12, 0.1],
			backgroundOpacity: 1.0,
		});
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
	});

	it('word-wraps long text to maxWidth', () => {
		const canvas = createTextCanvas({
			text: 'This is a much longer piece of text that should wrap across multiple lines',
			fontSize: 24,
			maxWidth: 200,
		});
		// Multi-line text should produce a taller canvas
		expect(canvas.height).toBeGreaterThan(30);
	});

	it('returns power-of-2 dimensions', () => {
		const canvas = createTextCanvas({
			text: 'Test',
			fontSize: 20,
		});
		const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
		expect(isPow2(canvas.width)).toBe(true);
		expect(isPow2(canvas.height)).toBe(true);
	});

	it('uses default fontSize when not specified', () => {
		const canvas = createTextCanvas({ text: 'Default size' });
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(canvas.width).toBeGreaterThan(0);
		expect(canvas.height).toBeGreaterThan(0);
	});

	it('respects alignment option', () => {
		// Alignment doesn't change dimensions, just canvas is created successfully
		for (const align of ['left', 'center', 'right'] as const) {
			const canvas = createTextCanvas({
				text: 'Aligned',
				fontSize: 24,
				align,
			});
			expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		}
	});

	it('handles empty text without crashing', () => {
		const canvas = createTextCanvas({ text: '' });
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		// Should still have positive power-of-2 dimensions (minimum size)
		expect(canvas.width).toBeGreaterThan(0);
		expect(canvas.height).toBeGreaterThan(0);
	});

	it('handles multi-line text with newlines', () => {
		const canvas = createTextCanvas({
			text: 'Line one\nLine two\nLine three',
			fontSize: 24,
		});
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(canvas.height).toBeGreaterThan(30);
	});

	it('returns cached canvas on repeated call with same spec', () => {
		const spec = { text: 'Cache me', fontSize: 24, color: [1, 0, 0] as [number, number, number] };
		const first = createTextCanvas(spec);
		const second = createTextCanvas(spec);
		// Should be the exact same canvas instance (cache hit)
		expect(second).toBe(first);
	});

	it('returns different canvas for different spec', () => {
		const first = createTextCanvas({ text: 'A', fontSize: 24 });
		const second = createTextCanvas({ text: 'B', fontSize: 24 });
		expect(second).not.toBe(first);
	});

	it('clearTextCache invalidates the cache', () => {
		const spec = { text: 'Cleared', fontSize: 24 };
		const first = createTextCanvas(spec);
		clearTextCache();
		const second = createTextCanvas(spec);
		// After clearing, a new canvas should be created
		expect(second).not.toBe(first);
	});
});
