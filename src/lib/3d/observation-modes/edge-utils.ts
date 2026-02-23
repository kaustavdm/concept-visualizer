// src/lib/3d/observation-modes/edge-utils.ts

/**
 * Compute Euler rotation [pitch, yaw, 0] to orient a PlayCanvas box's
 * default Y-axis from source toward target.
 *
 * PlayCanvas boxes have their long axis along Y. Scale should be
 * [thickness, length, thickness] to stretch along Y.
 *
 * - Yaw (Y rotation): atan2(dx, dz) — horizontal direction
 * - Pitch (X rotation): -atan2(dy, lengthXZ) — vertical tilt
 */
export function computeEdgeRotation(
	dx: number,
	dy: number,
	dz: number,
): [number, number, number] {
	const lengthXZ = Math.sqrt(dx * dx + dz * dz);
	const yaw = Math.atan2(dx, dz) * (180 / Math.PI);
	const pitch = -Math.atan2(dy, lengthXZ) * (180 / Math.PI);
	return [pitch, yaw, 0];
}
