/**
 * Every degree-radian conversion in core's `src/`, each app's `src/` and the repository's `scripts/` goes
 * through `degToRad` and `radToDeg` (`godot/math/math.ts`), which round as Godot's `Math::deg_to_rad` and
 * `Math::rad_to_deg` do. A hand-rolled `(d * Math.PI) / 180`, or its half angle over 360, rounds
 * differently, and so can three's own helpers, so neither may come back.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(srcDir, '../../..');
const scriptsDir = resolve(repoRoot, 'scripts');
const appsDir = resolve(repoRoot, 'apps');

/** The one file that defines the conversions, so it holds the factors. */
const DEFINITION_FILE = 'godot/math/math.ts';

const HAND_ROLLED_CONVERSION =
  /MathUtils\.(?:degToRad|radToDeg|DEG2RAD|RAD2DEG)|\bDEG2RAD\b|\bRAD2DEG\b|Math\.PI\s*\)?\s*\/\s*(?:180|360)\b|\b180\s*\/\s*Math\.PI|\*\s*180\s*\)\s*\/\s*Math\.PI|\*\s*\(?\s*Math\.PI\s*\/\s*(?:180|360)\b|\)\s*\*\s*\(?\s*180\b|\/\s*180\s*\)?\s*\*\s*Math\.PI/;

/** Every `.ts`, `.tsx`, `.js` and `.mjs` file under `dir`, relative to it, `node_modules` excluded. */
function sourceFiles(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') found.push(...sourceFiles(resolve(dir, entry.name), `${name}/`));
    } else if (/\.(?:tsx?|m?js)$/.test(entry.name)) found.push(name);
  }
  return found.sort();
}

function linesWithHandRolledConversion(source: string): number[] {
  const lines = source.split('\n');
  return lines.flatMap((line, index) => (HAND_ROLLED_CONVERSION.test(line) ? [index + 1] : []));
}

/** The `src/` tree of each app under `apps/`, as `apps/<name>/src`. */
function appSourceTrees(): { label: string; dir: string }[] {
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(appsDir, entry.name, 'src')))
    .map((entry) => ({ label: `apps/${entry.name}/src`, dir: resolve(appsDir, entry.name, 'src') }));
}

/** Each scanned file as `root/relative/path`, so an offender names its tree. */
function scannedFiles(): { label: string; path: string }[] {
  const trees = [{ label: 'src', dir: srcDir }, { label: 'scripts', dir: scriptsDir }, ...appSourceTrees()];
  return trees.flatMap(({ label, dir }) =>
    sourceFiles(dir).map((file) => ({ label: `${label}/${file}`, path: resolve(dir, file) }))
  );
}

describe('degree conversions', () => {
  it('finds the source, script and app files, so the sweep cannot pass vacuously', () => {
    const labels = scannedFiles().map(({ label }) => label);
    expect(labels).toContain(`src/${DEFINITION_FILE}`);
    expect(labels).toContain('scripts/distFreshness.mjs');
    expect(labels.some((label) => label.startsWith('apps/textscene-web/src/'))).toBe(true);
  });

  it.each([
    '(d * Math.PI) / 180',
    'degrees * (Math.PI / 180)',
    'radians * (180 / Math.PI)',
    '(r * 180) / Math.PI',
    '(fov * Math.PI) / 360',
    'fov * (Math.PI / 360)',
    'THREE.MathUtils.degToRad(d)',
    'MathUtils.radToDeg(r)',
    'const DEG2RAD = 0.01;',
  ])('flags the hand-rolled form %s, before trusting the sweep’s silence', (line) => {
    expect(linesWithHandRolledConversion(line)).toEqual([1]);
  });

  it('leaves a plain 180 alone (edge case)', () => {
    expect(linesWithHandRolledConversion('const turn = 180; // a half turn')).toEqual([]);
  });

  it('converts through degToRad and radToDeg in every file', () => {
    const offenders = scannedFiles()
      .filter(({ label }) => label !== `src/${DEFINITION_FILE}` && label !== 'src/degreeConversion.test.ts')
      .flatMap(({ label, path }) =>
        linesWithHandRolledConversion(readFileSync(path, 'utf8')).map((line) => `${label}:${line}`)
      );
    expect(offenders).toEqual([]);
  });
});
