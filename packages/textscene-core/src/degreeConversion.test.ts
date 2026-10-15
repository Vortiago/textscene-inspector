/**
 * Every degree-radian conversion in `src/` and the repository's `scripts/` goes through `degToRad` and `radToDeg`
 * (`godot/math/math.ts`), which round as Godot's `Math::deg_to_rad` and `Math::rad_to_deg` do. A
 * hand-rolled `(d * Math.PI) / 180` rounds differently, and so can three's own helpers, so neither
 * may come back.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(srcDir, '../../../scripts');

/** The one file that defines the conversions, so it holds the factors. */
const DEFINITION_FILE = 'godot/math/math.ts';

const HAND_ROLLED_CONVERSION =
  /MathUtils\.(?:degToRad|radToDeg|DEG2RAD|RAD2DEG)|\bDEG2RAD\b|\bRAD2DEG\b|Math\.PI\s*\)?\s*\/\s*180\b|\b180\s*\/\s*Math\.PI|\*\s*180\s*\)\s*\/\s*Math\.PI|\*\s*\(?\s*Math\.PI\s*\/\s*180\b|\)\s*\*\s*\(?\s*180\b|\/\s*180\s*\)?\s*\*\s*Math\.PI/;

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

/** Each scanned file as `root/relative/path`, so an offender names its tree. */
function scannedFiles(): { label: string; path: string }[] {
  return [
    ...sourceFiles(srcDir).map((file) => ({ label: `src/${file}`, path: resolve(srcDir, file) })),
    ...sourceFiles(scriptsDir).map((file) => ({ label: `scripts/${file}`, path: resolve(scriptsDir, file) })),
  ];
}

describe('degree conversions', () => {
  it('finds the source and script files, so the sweep cannot pass vacuously', () => {
    const labels = scannedFiles().map(({ label }) => label);
    expect(labels).toContain(`src/${DEFINITION_FILE}`);
    expect(labels).toContain('scripts/distFreshness.mjs');
  });

  it.each([
    '(d * Math.PI) / 180',
    'degrees * (Math.PI / 180)',
    'radians * (180 / Math.PI)',
    '(r * 180) / Math.PI',
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
