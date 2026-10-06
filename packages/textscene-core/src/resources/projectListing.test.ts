/** A project's files by extension, walked as Godot's editor scan walks it (`editor_file_system.cpp:1144-1199`). */

import { describe, expect, it } from 'vitest';
import { listScannedFiles, type DirectoryEntry } from './projectListing';

/** A directory reader over `paths`, the `res://` paths of the files in a tree, and a log of each directory it reads. */
function tree(paths: readonly string[]) {
  const read: string[] = [];
  const readDirectory = async (directory: string): Promise<DirectoryEntry[]> => {
    read.push(directory);
    const prefix = directory.endsWith('/') ? directory : `${directory}/`;
    const names = new Map<string, boolean>();
    for (const path of paths) {
      if (!path.startsWith(prefix)) continue;
      const [name, ...rest] = path.slice(prefix.length).split('/');
      names.set(name!, (names.get(name!) ?? false) || rest.length > 0);
    }
    return [...names].map(([name, isDirectory]) => ({ name, isDirectory }));
  };
  return { readDirectory, read };
}

const list = (paths: readonly string[]) => listScannedFiles(tree(paths).readDirectory, 'gdextension');

describe('listScannedFiles', () => {
  it('finds a file with the extension at the root and at any depth, in any case', async () => {
    const found = await list(['res://a.gdextension', 'res://addons/x/bin/B.GDExtension', 'res://tree.glb']);

    expect(found.sort()).toEqual(['res://a.gdextension', 'res://addons/x/bin/B.GDExtension']);
  });

  it('does not enter a dot-named directory', async () => {
    const { readDirectory, read } = tree([
      'res://.godot/a.gdextension',
      'res://addons/.hidden/b.gdextension',
    ]);

    expect(await listScannedFiles(readDirectory, 'gdextension')).toEqual([]);
    expect(read).not.toContain('res://.godot');
  });

  it('skips a directory that holds another project or a .gdignore, and everything under it', async () => {
    const found = await list([
      'res://vendor/other/project.godot',
      'res://vendor/other/bin/a.gdextension',
      'res://ignored/.gdignore',
      'res://ignored/b.gdextension',
      'res://kept/c.gdextension',
    ]);

    expect(found).toEqual(['res://kept/c.gdextension']);
  });

  it("keeps the root, whose own project.godot is the project's", async () => {
    expect(await list(['res://project.godot', 'res://a.gdextension'])).toEqual(['res://a.gdextension']);
  });

  it('matches the whole extension, not a longer one that ends with it', async () => {
    expect(await list(['res://a.gdextension.import', 'res://b.notgdextension'])).toEqual([]);
  });

  it('lists every scanned file when no extension is given', async () => {
    const { readDirectory } = tree(['res://a.tscn', 'res://art/b.png', 'res://.godot/c.import']);

    expect((await listScannedFiles(readDirectory)).sort()).toEqual(['res://a.tscn', 'res://art/b.png']);
  });
});
