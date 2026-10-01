/**
 * The watcher globs match the files the linter reads, in every case the importer accepts. Matched with `glob`, the
 * extension's own glob library, over a real directory: like VS Code's matcher, it expands a brace's alternatives and
 * reads a character class inside one.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { globSync } from 'glob';
import { GDEXTENSION_PATTERN, RESOURCE_FILES_PATTERN } from './watchPatterns';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'watch-patterns-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** The files of `files` under a fresh directory that `pattern` matches, sorted. */
function matched(pattern: string, files: readonly string[]): string[] {
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return globSync(pattern, { cwd: root, posix: true }).sort();
}

describe('RESOURCE_FILES_PATTERN', () => {
  it('matches a glTF file in any case, mixed case included', () => {
    const files = ['models/Tree.Glb', 'models/tree.glb', 'models/TREE.GLB', 'models/Rock.glTF', 'models/rock.gltf'];

    expect(matched(RESOURCE_FILES_PATTERN, files)).toEqual([...files].sort());
  });

  it('matches no file of another extension', () => {
    expect(matched(RESOURCE_FILES_PATTERN, ['models/tree.glbx', 'notes.txt'])).toEqual([]);
  });
});

describe('GDEXTENSION_PATTERN', () => {
  it('matches a .gdextension file in any case, at any depth', () => {
    const files = ['bin/a.gdextension', 'addons/x/bin/B.GDExtension'];

    expect(matched(GDEXTENSION_PATTERN, files)).toEqual([...files].sort());
  });

  it('matches no file of another extension', () => {
    expect(matched(GDEXTENSION_PATTERN, ['bin/a.gdextension.import', 'bin/a.so'])).toEqual([]);
  });
});
