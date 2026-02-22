/**
 * Lightweight fractional indexing for CRDT-safe ordering.
 * Uses base-36 string midpoints. No external dependencies.
 *
 * Positions are strings that sort lexicographically.
 * insertBetween(a, b) always returns a string that sorts between a and b.
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Generate a default starting position */
export function generatePosition(): string {
  return 'n'; // midpoint of [a-z] range
}

/**
 * Compute a position string that sorts between `lower` and `upper`.
 * If lower is undefined, returns something before upper.
 * If upper is undefined, returns something after lower.
 */
export function insertBetween(
  lower: string | undefined,
  upper: string | undefined,
): string {
  if (lower === undefined && upper === undefined) {
    return 'n';
  }

  if (lower === undefined) {
    // Insert before upper: take first char and decrement, or prepend
    const firstChar = upper!.charCodeAt(0);
    if (firstChar > 'a'.charCodeAt(0)) {
      return String.fromCharCode(firstChar - 1);
    }
    return 'a' + midstring(upper!.slice(1), undefined);
  }

  if (upper === undefined) {
    // Insert after lower: take last char and increment, or append
    const lastChar = lower.charCodeAt(lower.length - 1);
    if (lastChar < 'z'.charCodeAt(0)) {
      return lower.slice(0, -1) + String.fromCharCode(lastChar + 1);
    }
    return lower + 'n';
  }

  // Both defined — find midpoint
  return midstring(lower, upper);
}

/**
 * Find the lexicographic midpoint between two strings.
 */
function midstring(a: string, b: string | undefined): string {
  if (b !== undefined && a >= b) {
    throw new Error(`Cannot insert between "${a}" and "${b}": a must be < b`);
  }

  // Pad to same length
  const maxLen = Math.max(a.length, b?.length ?? 0) + 1;
  const padA = a.padEnd(maxLen, DIGITS[0]);
  const padB =
    b !== undefined
      ? b.padEnd(maxLen, DIGITS[DIGITS.length - 1])
      : DIGITS[DIGITS.length - 1].repeat(maxLen);

  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const charA = DIGITS.indexOf(padA[i]);
    const charB = DIGITS.indexOf(padB[i]);

    if (charA === charB) {
      result += DIGITS[charA];
      continue;
    }

    const mid = Math.floor((charA + charB) / 2);
    if (mid > charA) {
      result += DIGITS[mid];
      return result;
    }

    // Need more precision
    result += DIGITS[charA];
  }

  // Append midpoint character if we couldn't find a gap
  return result + 'n';
}

/**
 * Generate `count` evenly-spaced positions suitable for initial ordering.
 */
export function positionsForCount(count: number): string[] {
  if (count === 0) return [];
  const positions: string[] = [];
  const step = Math.floor(26 / (count + 1));
  for (let i = 0; i < count; i++) {
    const charCode = 'a'.charCodeAt(0) + step * (i + 1);
    positions.push(String.fromCharCode(Math.min(charCode, 'z'.charCodeAt(0))));
  }
  return positions;
}
