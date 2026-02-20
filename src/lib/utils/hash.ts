/** djb2 hash — fast, deterministic, no crypto needed for cache keys. */
export function hashContent(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
