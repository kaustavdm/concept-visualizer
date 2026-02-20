import { describe, it, expect } from 'vitest';
import { hashContent } from './hash';

describe('hashContent', () => {
  it('returns a string', () => {
    expect(typeof hashContent('hello')).toBe('string');
  });

  it('is deterministic', () => {
    expect(hashContent('hello world')).toBe(hashContent('hello world'));
  });

  it('differs for different inputs', () => {
    expect(hashContent('foo')).not.toBe(hashContent('bar'));
  });

  it('handles empty string', () => {
    expect(hashContent('')).toBe(hashContent(''));
  });

  it('handles long text without throwing', () => {
    const long = 'x'.repeat(100_000);
    expect(() => hashContent(long)).not.toThrow();
  });
});
