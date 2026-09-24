/** The Node-side reader of the generated scene manifest. */
import { describe, expect, it } from 'vitest';
import { parseFixtureManifest, readFixtureManifest } from './fixtureManifest.mjs';

describe('parseFixtureManifest', () => {
  it('reads the JSON array the generator writes', () => {
    const source = `export interface Fixture { name: string }

export const fixtures: Fixture[] = [
  { "name": "Plane", "file": "unit-plane-mesh.tscn", "category": "Unit" }
];
`;

    expect(parseFixtureManifest(source)).toEqual([
      { name: 'Plane', file: 'unit-plane-mesh.tscn', category: 'Unit' },
    ]);
  });

  it('reads an empty manifest', () => {
    expect(parseFixtureManifest('export const fixtures: Fixture[] = [];')).toEqual([]);
  });

  it('throws on a file with no fixtures array', () => {
    expect(() => parseFixtureManifest('export const scenes = [];')).toThrow(
      'expected `export const fixtures = [...]`'
    );
  });
});

describe('readFixtureManifest', () => {
  it('reads the committed manifest', () => {
    expect(readFixtureManifest().some((f) => f.file === 'unit-plane-mesh.tscn')).toBe(true);
  });
});
