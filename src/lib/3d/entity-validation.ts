/**
 * Validates an array of parsed entity specs for structural correctness.
 * Returns null if valid, or a descriptive error string if not.
 */
export function validateEntitySpecs(entities: unknown[]): string | null {
	for (let i = 0; i < entities.length; i++) {
		const e = entities[i] as Record<string, unknown>;
		if (!e || typeof e !== 'object') return `Entity ${i}: must be an object`;
		if (!e.id || typeof e.id !== 'string') return `Entity ${i}: missing "id" (string)`;
		if (!e.components || typeof e.components !== 'object')
			return `Entity ${i}: missing "components" (object)`;
	}
	return null;
}
