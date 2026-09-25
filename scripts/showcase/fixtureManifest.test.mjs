/**
 * The showcase's reader of the generated fixtures manifest: a pure parse of the source text,
 * and a read that resolves from the repo root rather than the working directory.
 */

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
