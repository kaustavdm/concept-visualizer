export interface FpsColorResult {
	color: string;
	glow: boolean;
}

/**
 * Maps FPS to a color on a red->yellow->green gradient via HSL interpolation.
 *
 * Gradient stops:
 *   0 FPS  -> hsl(0, 60%, 45%)    dull red
 *  24 FPS  -> hsl(45, 80%, 50%)   yellow
 *  60 FPS  -> hsl(142, 70%, 45%)  green
 *  90+ FPS -> hsl(142, 80%, 55%)  bright green + glow
 */
export function fpsToColor(fps: number): FpsColorResult {
	const clamped = Math.max(0, fps);

	let h: number, s: number, l: number;

	if (clamped <= 24) {
		const t = clamped / 24;
		h = t * 45;
		s = 60 + t * 20;
		l = 45 + t * 5;
	} else if (clamped <= 60) {
		const t = (clamped - 24) / 36;
		h = 45 + t * 97;
		s = 80 - t * 10;
		l = 50 - t * 5;
	} else {
		const t = Math.min(1, (clamped - 60) / 30);
		h = 142;
		s = 70 + t * 10;
		l = 45 + t * 10;
	}

	return {
		color: `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`,
		glow: clamped >= 90,
	};
}
