/**
 * The showcase's reader of the generated fixtures manifest: a pure parse of the source text,
 * and a read that resolves from the repo root rather than the working directory.
 */

import { describe, expect, it } from 'vitest';
import { parseFixtureManifest, readFixtureLookup } from './fixtureManifest.mjs';

/** The shape `pnpm generate:fixtures` writes. */
const GENERATED = `export interface Fixture {
  name: string;
  file: string;
}

export const fixtures: Fixture[] = [
  {
    "name": "Child_cube",
    "file": "child_cube.tscn",
    "category": "Other"
  }
];
`;

describe('parseFixtureManifest', () => {
  it('reads the entries of the generated array', () => {
    expect(parseFixtureManifest(GENERATED)).toEqual([
      { name: 'Child_cube', file: 'child_cube.tscn', category: 'Other' },
    ]);
  });

  it('reads no entries from a source that declares no fixtures array', () => {
    expect(parseFixtureManifest('export const other = [];\n')).toEqual([]);
  });

  it('throws on an array that is not JSON, rather than guessing its entries', () => {
    expect(() => parseFixtureManifest("export const fixtures = [{ name: 'x' }];")).toThrow(SyntaxError);
  });
});

describe('readFixtureLookup', () => {
  it("maps a label in this checkout's manifest to its file", () => {
    expect(readFixtureLookup()('Child_cube')).toBe('child_cube.tscn');
  });

  it('answers undefined for a label the manifest does not hold', () => {
    expect(readFixtureLookup()('No such fixture')).toBeUndefined();
  });
});
