/** The previewer URL that opens one fixture. */
import { describe, expect, it } from 'vitest';
import { fixtureUrl } from './fixtureUrl.mjs';

describe('fixtureUrl', () => {
  it('opens a fixture from the site root', () => {
    expect(fixtureUrl('http://127.0.0.1:4173', 'unit-glow-mix.tscn')).toBe(
      'http://127.0.0.1:4173/?fixture=unit-glow-mix.tscn'
    );
  });

  it('takes a site with a trailing slash the same way', () => {
    expect(fixtureUrl('https://textscene-inspector.pages.dev/', 'unit-glow-mix.tscn')).toBe(
      'https://textscene-inspector.pages.dev/?fixture=unit-glow-mix.tscn'
    );
  });

  it('adds each extra parameter and drops one that is null or undefined', () => {
    const url = fixtureUrl('http://127.0.0.1:4173', 'a b.tscn', {
      camera: '1,2,3',
      select: null,
      x: undefined,
    });

    expect(url).toBe('http://127.0.0.1:4173/?fixture=a%20b.tscn&camera=1%2C2%2C3');
  });
});
