import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../../..');
const SOURCE_EXT = /\.(ts|tsx)$/;
/** A test file reaches no bundle, so it may import the package. */
const TEST_FILE = /\.test\.tsx?$/;
const SKIP_DIRS = new Set(['node_modules', 'dist']);

/** Any form that pulls the package into a module graph; prose that names it does not match. */
const IMPORTS_LIBRARY = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]brotli(?:\/[^'"]*)?['"]/;

/** The one file that imports brotli, dynamically, so the decoder stays off the webview's first chunk. */
const SITE = 'r3f/controls/native/text/brotliDecoder.ts';
const ALLOWED = new Set([SITE]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry) && !TEST_FILE.test(entry)) out.push(full);
  }
  return out;
}

const IMPORTING_FILES = walk(SRC)
  .filter((file) => IMPORTS_LIBRARY.test(readFileSync(file, 'utf8')))
  .map((file) => relative(SRC, file).split(sep).join('/'))
  .sort();

// A static import puts the decoder and its dictionary on the web previewer's initial-paint path.
describe('brotli import site', () => {
  it('is imported by only the allowlisted files', () => {
    const offenders = IMPORTING_FILES.filter((file) => !ALLOWED.has(file));

    expect(offenders, `move the import into ${SITE}: ${offenders.join(', ')}`).toEqual([]);
  });

  it('finds the import site at all, so the scan is not vacuous', () => {
    expect(IMPORTING_FILES).toContain(SITE);
  });

  it('imports the decoder dynamically, never statically', () => {
    const source = readFileSync(join(SRC, SITE), 'utf8');

    expect(source).toMatch(/import\(\s*'brotli\/decompress'\s*\)/);
    expect(source).not.toMatch(/^\s*import[^(]*from\s+'brotli/m);
  });
});
