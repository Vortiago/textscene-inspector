import { describe, expect, it } from 'vitest';
import { hostReturnsImageParts } from './imageResultSupport';

describe('hostReturnsImageParts', () => {
  it.each(['1.105.0', '1.105.1', '1.99.0'])('refuses %s, whose host fails on a data part', (version) => {
    expect(hostReturnsImageParts(version)).toBe(false);
  });

  it.each(['1.106.0', '1.145.0', '2.0.0'])('accepts %s', (version) => {
    expect(hostReturnsImageParts(version)).toBe(true);
  });
});
