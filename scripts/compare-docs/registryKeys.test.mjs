/**
 * The wildcard semantics both coverage ledgers count against.
 *
 * No dist and no registry: this pins the MEANING of a registered key, which is
 * what decides whether an engine property reads as covered. A matcher that
 * quietly widened would drive both ledgers' unvalidated count to zero and read
 * as a codebase with no gaps.
 */

import { describe, expect, it } from 'vitest';
import { keyMatcher, unvalidatedByClass } from './registryKeys.mjs';

describe('keyMatcher', () => {
  it('matches a plain key exactly', () => {
    const m = keyMatcher('albedo_color');
    expect(m('albedo_color')).toBe(true);
    expect(m('albedo_color_2')).toBe(false);
    expect(m('albedo')).toBe(false);
  });

  it('lets `*` stand for one path segment, never for a separator', () => {
    const m = keyMatcher('glow_levels/*');
    expect(m('glow_levels/1')).toBe(true);
    expect(m('glow_levels/max')).toBe(true);
    expect(m('glow_levels/a/b')).toBe(false);
    expect(m('glow_levels/')).toBe(false);
  });

  it('lets `#` stand for digits only, glued to the prefix', () => {
    // PropertyListHelper writes the index onto the prefix: `item_0/text`.
    const m = keyMatcher('item_#/*');
    expect(m('item_0/text')).toBe(true);
    expect(m('item_12/icon')).toBe(true);
    expect(m('item_x/text')).toBe(false);
    expect(m('item_/text')).toBe(false);
  });

  it('escapes the regex metacharacters a key can hold', () => {
    const m = keyMatcher('a.b');
    expect(m('a.b')).toBe(true);
    expect(m('axb')).toBe(false);
  });
});

describe('unvalidatedByClass', () => {
  const registry = (keys) => ({ getOwnKeys: (cls) => keys[cls] ?? [] });

  it('reports per declaring class, ignoring what a base covers', () => {
    // The base-walk is deliberately not applied: a validator for a base's
    // property belongs on the base, so the leaf must not be credited with it.
    const engine = {
      BaseMaterial3D: [{ name: 'albedo_color' }, { name: 'roughness' }],
      StandardMaterial3D: [{ name: 'albedo_color' }, { name: 'roughness' }],
    };
    const covered = new Set(['BaseMaterial3D', 'StandardMaterial3D']);
    // Widest gap first, so the row a reader sees is the one worth acting on.
    expect(unvalidatedByClass(engine, registry({ BaseMaterial3D: ['albedo_color'] }), covered)).toEqual(
      [
        { cls: 'StandardMaterial3D', missing: ['albedo_color', 'roughness'] },
        { cls: 'BaseMaterial3D', missing: ['roughness'] },
      ]
    );
  });

  it('skips a class outside the covered scope', () => {
    const engine = { Unscoped: [{ name: 'anything' }] };
    expect(unvalidatedByClass(engine, registry({}), new Set())).toEqual([]);
  });

  it('credits a wildcard key for the whole family it covers', () => {
    const engine = { OptionButton: [{ name: 'item_0/text' }, { name: 'item_1/text' }] };
    const rows = unvalidatedByClass(
      engine,
      registry({ OptionButton: ['item_#/*'] }),
      new Set(['OptionButton'])
    );
    expect(rows).toEqual([]);
  });
});
