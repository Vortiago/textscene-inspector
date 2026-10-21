// @vitest-environment node
/** The `node:fs` adapter of {@link ResRoots}: what only a real disk shows, such as links, real stamps and bytes. */

import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDiskResRoots } from './diskProject';
import { forwardSlashes } from './resPath';
import { rootDirOf } from './testing/rootDirOf';

let tempDir: string;
let projectDir: string;
let scenePath: string;

/** The root of the scene at `scenePath`, from a fresh instance with no workspace. */
async function sceneRoot() {
  return (await createDiskResRoots(null).rootOf(scenePath))!;
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-disk-project-'));
  projectDir = join(tempDir, 'game');
  mkdirSync(join(projectDir, 'scenes', 'deep'), { recursive: true });
  mkdirSync(join(projectDir, 'models'));
  writeFileSync(join(projectDir, 'project.godot'), 'config_version=5\n');
  writeFileSync(join(projectDir, 'models', 'tree.glb'), new Uint8Array([0x67, 0x6c, 0x54, 0x46]));
  writeFileSync(join(projectDir, 'scenes', 'level.tscn'), '[gd_scene format=3]\n');
  scenePath = join(projectDir, 'scenes', 'deep', 'level.tscn');
  writeFileSync(scenePath, '[gd_scene format=3]\n');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createDiskResRoots rootOf', () => {
  it('gives the project root for a scene inside a project', async () => {
    expect(await rootDirOf(createDiskResRoots(null), scenePath)).toBe(forwardSlashes(projectDir));
  });

  it('finds the project.godot above a workspace that lies inside the project', async () => {
    // A CLI run inside `game/scenes` takes the project above it: the walk has no bound but the filesystem root.
    const workspace = join(projectDir, 'scenes');

    expect(await rootDirOf(createDiskResRoots(workspace), scenePath)).toBe(forwardSlashes(projectDir));
  });

  it("gives the scene's own directory for a loose scene inside the workspace", async () => {
    const loose = join(tempDir, 'loose', 'dungeon');
    mkdirSync(loose, { recursive: true });
    writeFileSync(join(loose, 'dungeon.tscn'), '[gd_scene format=3]\n');

    expect(await rootDirOf(createDiskResRoots(tempDir), join(loose, 'dungeon.tscn'))).toBe(
      forwardSlashes(loose)
    );
  });
});

describe('createDiskResRoots invalidate', () => {
  /** A fresh directory per test, since each one changes the disk after a first read. */
  function freshDir(): string {
    return mkdtempSync(join(tmpdir(), 'tscn-disk-forget-'));
  }

  it('moves the root of a scene when a project.godot is created above it, and back when it is deleted', async () => {
    const dir = freshDir();
    mkdirSync(join(dir, 'scenes'));
    const scene = join(dir, 'scenes', 'level.tscn');
    writeFileSync(scene, '[gd_scene format=3]\n');
    const roots = createDiskResRoots(dir);
    try {
      expect(await rootDirOf(roots, scene)).toBe(forwardSlashes(join(dir, 'scenes')));

      writeFileSync(join(dir, 'project.godot'), 'config_version=5\n');
      roots.invalidate(join(dir, 'project.godot'));
      expect(await rootDirOf(roots, scene)).toBe(forwardSlashes(dir));

      rmSync(join(dir, 'project.godot'));
      roots.invalidate(join(dir, 'project.godot'));
      expect(await rootDirOf(roots, scene)).toBe(forwardSlashes(join(dir, 'scenes')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets the listing see a file created after the first listing', async () => {
    const dir = freshDir();
    writeFileSync(join(dir, 'project.godot'), 'config_version=5\n');
    const roots = createDiskResRoots(null);
    try {
      const root = (await roots.rootOf(join(dir, 'level.tscn')))!;
      await root.listPaths();
      writeFileSync(join(dir, 'late.png'), '');
      roots.invalidate(join(dir, 'late.png'));

      expect(await root.listPaths()).toContain('res://late.png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a disk root', () => {
  it('reads a binary resource as bytes and a text resource as a string', async () => {
    const root = await sceneRoot();
    const bytes = await root.loadResource('res://models/tree.glb', 'PackedScene');

    expect([...new Uint8Array(bytes as ArrayBuffer)]).toEqual([0x67, 0x6c, 0x54, 0x46]);
    expect(await root.loadResource('res://scenes/level.tscn', 'PackedScene')).toBe('[gd_scene format=3]\n');
  });

  it('stamps a file with its modification time and size', async () => {
    const root = await sceneRoot();
    const { mtimeMs, size } = statSync(join(projectDir, 'models', 'tree.glb'));

    expect(await root.stamp('res://models/tree.glb')).toBe(`${mtimeMs}:${size}`);
  });

  it('changes the stamp of a file that is rewritten', async () => {
    const root = await sceneRoot();
    const file = join(projectDir, 'models', 'stamped.glb');
    writeFileSync(file, new Uint8Array([1]));
    const before = await root.stamp('res://models/stamped.glb');
    writeFileSync(file, new Uint8Array([1, 2]));

    expect(await root.stamp('res://models/stamped.glb')).not.toBe(before);
  });

  it('resolves a file and not a directory', async () => {
    const root = await sceneRoot();

    expect(await root.resolve('res://models/tree.glb')).toBe(
      forwardSlashes(join(projectDir, 'models', 'tree.glb'))
    );
    expect(await root.resolve('res://models')).toBeNull();
  });
});

describe('a disk root listing', () => {
  let listedDir: string;

  beforeAll(() => {
    listedDir = join(tempDir, 'listed');
    const files: Record<string, string> = {
      'project.godot': 'config_version=5\n',
      'scenes/level.tscn': '[gd_scene format=3]\n',
      'bin/a.gdextension': '',
      'addons/x/bin/B.GDExtension': '',
      '.godot/c.gdextension': '',
      'ignored/.gdignore': '',
      'ignored/d.gdextension': '',
      'nested/project.godot': 'config_version=5\n',
      'nested/e.gdextension': '',
    };
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(listedDir, file)), { recursive: true });
      writeFileSync(join(listedDir, file), text);
    }
    // A link back up the tree: the walk follows it once and does not loop.
    symlinkSync(join(listedDir, 'addons'), join(listedDir, 'addons', 'x', 'loop'), 'dir');
    // The scan follows a link to a directory, and a link to nothing is no directory (`dir_access_unix.cpp:167-175`).
    mkdirSync(join(tempDir, 'linked-target'));
    writeFileSync(join(tempDir, 'linked-target', 'inside.png'), '');
    symlinkSync(join(tempDir, 'linked-target'), join(listedDir, 'linked'), 'dir');
    symlinkSync(join(listedDir, 'absent'), join(listedDir, 'dangling'), 'dir');
  });

  async function listedRoot() {
    return (await createDiskResRoots(null).rootOf(join(listedDir, 'scenes', 'level.tscn')))!;
  }

  it("lists each GDExtension the editor's scan finds, in any case, and none it skips", async () => {
    const listed = await (await listedRoot()).listFiles('gdextension');

    expect(listed).toContain('res://bin/a.gdextension');
    expect(listed).toContain('res://addons/x/bin/B.GDExtension');
    expect(listed.filter((path) => !path.startsWith('res://addons/x/loop/')).sort()).toEqual([
      'res://addons/x/bin/B.GDExtension',
      'res://bin/a.gdextension',
    ]);
  });

  it('lists the files of a project as res:// paths, sorted, without the data directory or a nested project', async () => {
    const paths = await (await listedRoot()).listPaths();

    expect(paths).toContain('res://scenes/level.tscn');
    expect(paths.some((path) => path.startsWith('res://.godot/') || path.startsWith('res://nested/'))).toBe(
      false
    );
    expect([...paths]).toEqual([...paths].sort());
  });

  it('enters a link to a directory, and lists a dangling link as a file', async () => {
    const paths = await (await listedRoot()).listPaths();

    expect(paths).toContain('res://linked/inside.png');
    expect(paths).toContain('res://dangling');
  });
});
