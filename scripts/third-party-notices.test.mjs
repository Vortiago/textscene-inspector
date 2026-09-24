/**
 * Asserts that every file transcribed from Godot source (such as `skyShaders.ts`) is listed in
 * `THIRD-PARTY-NOTICES.md`: the bundle strips the inline MIT notice, and the notices file travels
 * with the VSIX. Detection keys on the Godot copyright line, not a path allowlist, so copying the
 * notice into a new port is what gets it caught.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const NOTICES = join(REPO_ROOT, 'THIRD-PARTY-NOTICES.md');
const VSCODE_COPY = join(REPO_ROOT, 'apps', 'textscene-vscode', 'THIRD-PARTY-NOTICES.md');

/** The line every Godot-derived file carries. Matched loosely on the two names. */
const GODOT_COPYRIGHT = /Copyright \(c\) 2007-2014 Juan Linietsky, Ariel Manzur/;

/** Trees that can contain derived source. `node_modules` and build output excluded. */
const SEARCH_ROOTS = ['packages', 'scripts', 'apps'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.git', 'baselines', 'public']);
const SOURCE_EXT = /\.(ts|tsx|mjs|js)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** Every source file carrying the Godot copyright, as repo-relative POSIX paths. */
function derivedFiles() {
  const found = [];
  for (const root of SEARCH_ROOTS) {
    for (const file of walk(join(REPO_ROOT, root))) {
      // The notices test itself contains the pattern; it is not derived source.
      if (file === resolve(import.meta.filename)) continue;
      if (GODOT_COPYRIGHT.test(readFileSync(file, 'utf8'))) {
        found.push(relative(REPO_ROOT, file).split(sep).join('/'));
      }
    }
  }
  return found.sort();
}

describe('THIRD-PARTY-NOTICES.md', () => {
  it('exists at the repo root', () => {
    expect(() => readFileSync(NOTICES, 'utf8')).not.toThrow();
  });

  it('carries the full Godot MIT licence text, not just an attribution line', () => {
    const text = readFileSync(NOTICES, 'utf8');
    // A bare copyright line is not a licence grant. The MIT licence requires the permission and
    // warranty clauses.
    expect(text).toMatch(GODOT_COPYRIGHT);
    expect(text).toContain('Permission is hereby granted, free of charge');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it('lists every source file that carries the Godot copyright', () => {
    const text = readFileSync(NOTICES, 'utf8');
    const missing = derivedFiles().filter((file) => !text.includes(file));
    expect(missing, `add these to THIRD-PARTY-NOTICES.md: ${missing.join(', ')}`).toEqual([]);
  });

  it('finds derived files at all (the scan is not silently matching nothing)', () => {
    // Without this, a broken walk would make the listing assertion vacuously pass.
    expect(derivedFiles().length).toBeGreaterThan(0);
  });

  it('is byte-identical to the copy shipped in the VSIX', () => {
    // `vsce package` picks up the copy beside the extension's package.json, since `.vscodeignore`
    // is a denylist. The root file is authoritative, and the copy must match it.
    expect(readFileSync(VSCODE_COPY, 'utf8')).toBe(readFileSync(NOTICES, 'utf8'));
  });
});
