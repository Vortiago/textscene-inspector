/**
 * The Node-side reader of the generated scene manifest: a pure parse of the source text, and
 * a read that resolves from the repo root rather than the working directory.
 */
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { parseFixtureManifest, readFixtureLookup, readFixtureManifest } from './fixtureManifest.mjs';

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

  it('throws on an array that is not JSON, rather than guessing its entries', () => {
    expect(() => parseFixtureManifest("export const fixtures = [{ name: 'x' }];")).toThrow(SyntaxError);
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

describe('readFixtureLookup', () => {
  it("maps a label in this checkout's manifest to its file", () => {
    expect(readFixtureLookup()('Child_cube')).toBe('child_cube.tscn');
  });

  it('answers undefined for a label the manifest does not hold', () => {
    expect(readFixtureLookup()('No such fixture')).toBeUndefined();
  });

  it('reads the same manifest when the process runs outside the repo', () => {
    const moduleUrl = new URL('./fixtureManifest.mjs', import.meta.url).href;
    const script = `import { readFixtureLookup } from ${JSON.stringify(moduleUrl)};
process.stdout.write(String(readFixtureLookup()('Child_cube')));`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    expect(run.stderr).toBe('');
    expect(run.stdout).toBe('child_cube.tscn');
  });
});
