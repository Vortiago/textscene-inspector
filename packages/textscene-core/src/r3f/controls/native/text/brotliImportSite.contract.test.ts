/**
 * `brotli` is imported from exactly one file, and only dynamically: a static import puts the decoder
 * and its dictionary on the webview's initial-paint path for every scene, and the bundle budget has
 * enough headroom to miss it.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../../..');
const SOURCE_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist']);

/** Any form that pulls the package into a module graph; prose that names it does not match. */
const IMPORTS_LIBRARY = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]brotli(?:\/[^'"]*)?['"]/;

const SITE = 'r3f/controls/native/text/brotliDecoder.ts';
/** This file matches its own pattern, because the pattern is written down in it. */
const ALLOWED = new Set([SITE, 'r3f/controls/native/text/brotliImportSite.contract.test.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

function importingFiles(): string[] {
  return walk(SRC)
    .filter((file) => IMPORTS_LIBRARY.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).split(sep).join('/'))
    .sort();
}

describe('brotli import site', () => {
  it('is imported by only the allowlisted files', () => {
    const offenders = importingFiles().filter((file) => !ALLOWED.has(file));

    expect(offenders, `move the import into ${SITE}: ${offenders.join(', ')}`).toEqual([]);
  });

  it('finds the import site at all, so the scan is not vacuous', () => {
    expect(importingFiles()).toContain(SITE);
  });

  it('imports the decoder dynamically, never statically', () => {
    const source = readFileSync(join(SRC, SITE), 'utf8');

    expect(source).toMatch(/import\(\s*'brotli\/decompress'\s*\)/);
    expect(source).not.toMatch(/^\s*import[^(]*from\s+'brotli/m);
  });
});
