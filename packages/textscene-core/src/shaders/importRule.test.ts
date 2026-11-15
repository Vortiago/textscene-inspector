/**
 * The shader module's import rule (ADR-0072): a file of `shaders/` imports `three`, `three/tsl`,
 * `three/webgpu`, `three/addons/*`, a file of `godot/` or a file of its own, and nothing else. It
 * walks the value-import closure of each file of the module, so a file the entry does not reach yet
 * keeps the rule too. Type-only imports are skipped: the bundler erases them.
 */

import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bareSpecifiers, walkImportClosure, type ImportClosure } from '@textscene/dev-kit';

const shadersDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(shadersDir, '..');

/** The bare specifiers a file of the module may import. */
const ALLOWED_BARE = [/^three$/, /^three\/tsl$/, /^three\/webgpu$/, /^three\/addons\/.+/];

/** The directories of core a file of the module may import, besides its own. */
const ALLOWED_DIRECTORIES = ['shaders', 'godot'].map((name) => join(srcRoot, name) + sep);

/** Each file of the module, test kits included: a test file imports what it tests, so it is left out. */
const moduleFiles = readdirSync(shadersDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
  .map((name) => join(shadersDir, name));

const closures: ImportClosure[] = moduleFiles.map((file) => walkImportClosure(file));

describe('shader module import rule (ADR-0072)', () => {
  it('walks the entry and every file beside it', () => {
    expect(moduleFiles).toContain(join(shadersDir, 'index.ts'));
    expect(closures.flatMap((closure) => closure.unresolved)).toEqual([]);
  });

  it('reaches no file of core outside shaders/ and godot/', () => {
    const outside = closures
      .flatMap((closure) => [...closure.files])
      .filter((file) => !ALLOWED_DIRECTORIES.some((directory) => file.startsWith(directory)))
      .map((file) => relative(srcRoot, file));

    expect([...new Set(outside)]).toEqual([]);
  });

  it('imports no package but three', () => {
    const imported = closures.flatMap((closure) => bareSpecifiers(closure));
    const outside = imported.filter((specifier) => !ALLOWED_BARE.some((pattern) => pattern.test(specifier)));

    expect([...new Set(outside)]).toEqual([]);
  });
});
