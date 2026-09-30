import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_LAYOUT_QUERY, isCompactLayout } from './narrowLayout';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('isCompactLayout', () => {
  it('asks matchMedia for the compact query', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    window.matchMedia = matchMedia;
    expect(isCompactLayout()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(COMPACT_LAYOUT_QUERY);
  });

  it('is false where the query does not match', () => {
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
    expect(isCompactLayout()).toBe(false);
  });

  it('is false where matchMedia is missing', () => {
    // @ts-expect-error: a host without matchMedia.
    window.matchMedia = undefined;
    expect(isCompactLayout()).toBe(false);
  });

  it('is false where matchMedia throws', () => {
    window.matchMedia = () => {
      throw new Error('blocked');
    };
    expect(isCompactLayout()).toBe(false);
  });
});
