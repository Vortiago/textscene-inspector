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
import {
  ANY_PATH_PATTERN,
  GDEXTENSION_PATTERN,
  RESOURCE_FILES_PATTERN,
  SCAN_STOP_FILES_PATTERN,
} from './watchPatterns';
import { LOADED_FILE_EXTENSIONS } from '@textscene/core/resources/resourceProviderUtils';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'watch-patterns-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * The paths under a fresh directory holding `files` that `pattern` matches, sorted. VS Code's `*` matches a name that
 * starts with a dot (`[^/\\]*?`, `glob.ts:48`, `:56` in VS Code), and `dot` asks `glob` to do the same.
 */
function matched(pattern: string, files: readonly string[], { dot = false } = {}): string[] {
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return globSync(pattern, { cwd: root, posix: true, dot }).sort();
}

describe('RESOURCE_FILES_PATTERN', () => {
  it('matches a glTF file in any case, mixed case included', () => {
    // One base name per spelling: a case-insensitive disk (macOS, Windows) keeps `tree.glb` and `TREE.GLB` as one file.
    const files = ['models/a.Glb', 'models/b.glb', 'models/c.GLB', 'models/d.glTF', 'models/e.gltf'];

    expect(matched(RESOURCE_FILES_PATTERN, files)).toEqual([...files].sort());
  });

  it('matches no file of another extension', () => {
    expect(matched(RESOURCE_FILES_PATTERN, ['models/tree.glbx', 'notes.txt'])).toEqual([]);
  });

  it('matches a file of every extension a scene can load, in any case', () => {
    const files = LOADED_FILE_EXTENSIONS.flatMap((extension) => [
      `a/lower${extension}`,
      `a/UPPER${extension.toUpperCase()}`,
    ]);

    expect(matched(RESOURCE_FILES_PATTERN, files)).toEqual([...files].sort());
  });

  it('matches the import sidecar, a font and a glTF buffer', () => {
    const files = ['models/ship.glb.import', 'fonts/body.ttf', 'fonts/body.woff2', 'models/ship.bin'];

    expect(matched(RESOURCE_FILES_PATTERN, files)).toEqual([...files].sort());
  });

  it('leaves the project file to its own watcher', () => {
    expect(matched(RESOURCE_FILES_PATTERN, ['project.godot'])).toEqual([]);
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

describe('SCAN_STOP_FILES_PATTERN', () => {
  it('matches a project.godot or a .gdignore at any depth', () => {
    const files = ['addons/x/.gdignore', 'nested/project.godot', 'project.godot'];

    expect(matched(SCAN_STOP_FILES_PATTERN, files)).toEqual([...files].sort());
  });

  it('matches no file that only resembles one', () => {
    expect(matched(SCAN_STOP_FILES_PATTERN, ['addons/x/gdignore.txt', 'project.godot.bak'])).toEqual([]);
  });
});

describe('ANY_PATH_PATTERN', () => {
  it('matches a folder at any depth as well as a file, so the one delete VS Code reports for a folder reaches it', () => {
    const files = ['addons/gltf_ext/ext.gdextension', '.godot/extension_list.cfg'];

    expect(matched(ANY_PATH_PATTERN, files, { dot: true })).toEqual(
      [
        '.godot',
        '.godot/extension_list.cfg',
        'addons',
        'addons/gltf_ext',
        'addons/gltf_ext/ext.gdextension',
      ].sort()
    );
  });
});
