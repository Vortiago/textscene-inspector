/**
 * Guards `THIRD-PARTY-NOTICES.md` against the two ways it silently rots.
 *
 * This repo reproduces Godot's rendering behaviour, and doing that faithfully means
 * transcribing engine source rather than approximating it (see `skyShaders.ts`, which
 * explains that reasoning about itself). Every such file carries the Godot MIT notice
 * inline AND must be listed in the root notices file, because the inline comment is
 * stripped from the shipped bundle while the notices file is what actually travels with
 * the VSIX.
 *
 * The failure this exists to catch already happened once: `skyShaders.ts` and
 * `godotToneMapping.ts` both ended with "See THIRD-PARTY-NOTICES.md" for months while no
 * such file existed anywhere in the repo. A port is easy to add and a notices row is easy
 * to forget, so the link is asserted rather than trusted.
 *
 * Detection keys on the Godot copyright line, not on a path allowlist, so a new port is
 * caught by the act of copying the notice into it.
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
    // A bare copyright line is not a licence grant. The permission and warranty
    // clauses are the parts the MIT licence actually requires us to reproduce.
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
    // `.vscodeignore` is a denylist and does not exclude root markdown, so the copy
    // beside the extension's package.json is what `vsce package` picks up. The root
    // file is authoritative; this asserts the copy has not drifted behind it.
    expect(readFileSync(VSCODE_COPY, 'utf8')).toBe(readFileSync(NOTICES, 'utf8'));
  });
});
