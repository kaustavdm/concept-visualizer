// src/lib/3d/text-renderer.ts
//
// Pure utility: renders text to an HTMLCanvasElement suitable for use
// as a PlayCanvas texture source.  No PlayCanvas dependency — only DOM canvas API.

import type { TextComponentSpec } from './entity-spec';

/** Round up to the next power of two (minimum 16). */
function nextPow2(n: number): number {
	const min = 16;
	if (n <= min) return min;
	return Math.pow(2, Math.ceil(Math.log2(n)));
}

/** Convert a 0-1 RGB triple to a CSS rgba() string. */
function toRgba(c: [number, number, number], alpha = 1): string {
	return `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${alpha})`;
}

/**
 * Word-wrap `text` to fit within `maxWidth` pixels using the given 2D context.
 * Handles explicit newlines (\n) and splits long words at maxWidth boundaries.
 * Returns an array of lines.
 */
function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	// Split on explicit newlines first
	const paragraphs = text.split('\n');
	const lines: string[] = [];

	for (const paragraph of paragraphs) {
		if (paragraph === '') {
			lines.push('');
			continue;
		}
		const words = paragraph.split(/\s+/);
		let currentLine = '';

		for (const word of words) {
			if (!word) continue;
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const metrics = ctx.measureText(testLine);

			if (metrics.width > maxWidth && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) {
			lines.push(currentLine);
		}
	}

	// Always return at least one line (even for empty input)
	return lines.length > 0 ? lines : [''];
}

/**
 * Create an HTMLCanvasElement with rendered text, ready to be used as a
 * PlayCanvas texture source via `texture.setSource(canvas)`.
 *
 * Colors in `spec` are 0-1 range (PlayCanvas convention) and are converted
 * to 0-255 for canvas drawing.  Output canvas dimensions are rounded up to
 * the next power of two for WebGL texture compatibility.
 */
export function createTextCanvas(spec: TextComponentSpec): HTMLCanvasElement {
	const fontSize = spec.fontSize ?? 24;
	const color: [number, number, number] = spec.color ?? [1, 1, 1];
	const align = spec.align ?? 'center';
	const padding = Math.ceil(fontSize * 0.5);
	const lineSpacing = Math.ceil(fontSize * 1.4);
	const font = `${fontSize}px sans-serif`;

	// --- Measure pass ---
	// We need a temporary canvas/context to measure text before allocating
	// the final power-of-2 canvas.
	const measureCanvas = document.createElement('canvas');
	measureCanvas.width = 1;
	measureCanvas.height = 1;
	const measureCtx = measureCanvas.getContext('2d')!;
	measureCtx.font = font;

	const maxWidth = spec.maxWidth;
	const lines = maxWidth
		? wrapText(measureCtx, spec.text, maxWidth)
		: spec.text.split('\n').map((l) => l || '');

	// Ensure at least one line for empty text
	if (lines.length === 0) lines.push('');

	// Determine the widest line
	let maxLineWidth = 0;
	for (const line of lines) {
		const w = measureCtx.measureText(line).width;
		if (w > maxLineWidth) maxLineWidth = w;
	}

	// Compute raw dimensions
	const rawWidth = Math.ceil(maxLineWidth + padding * 2);
	const rawHeight = Math.ceil(lineSpacing * lines.length + padding * 2);

	// Final canvas with power-of-2 dimensions
	const canvas = document.createElement('canvas');
	canvas.width = nextPow2(rawWidth);
	canvas.height = nextPow2(rawHeight);

	const ctx = canvas.getContext('2d')!;

	// --- Background ---
	if (spec.background) {
		const bgAlpha = spec.backgroundOpacity ?? 1.0;
		ctx.fillStyle = toRgba(spec.background, bgAlpha);
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	} else {
		// Transparent background
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}

	// --- Text ---
	ctx.font = font;
	ctx.fillStyle = toRgba(color);
	ctx.textBaseline = 'top';

	// Set alignment
	let textX: number;
	if (align === 'center') {
		ctx.textAlign = 'center';
		textX = canvas.width / 2;
	} else if (align === 'right') {
		ctx.textAlign = 'right';
		textX = canvas.width - padding;
	} else {
		ctx.textAlign = 'left';
		textX = padding;
	}

	// Vertical centering: center the text block within the power-of-2 canvas
	const textBlockHeight = lineSpacing * lines.length;
	const startY = Math.max(padding, (canvas.height - textBlockHeight) / 2);

	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i], textX, startY + i * lineSpacing);
	}

	return canvas;
}
