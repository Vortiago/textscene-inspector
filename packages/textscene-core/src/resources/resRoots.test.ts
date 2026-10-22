/** A scene's `res://` root, answered through an in-memory filesystem port: the seam a Node host's adapter fills. */

import { describe, expect, it } from 'vitest';
import { rootDirOf } from './testing/rootDirOf';
import { createResRoots, type ResRoot, type ResRoots, type ResRootsPort } from './resRoots';

/** The in-memory port's files by absolute path, forward slashes: a test adds or removes one to change the disk. */
type MemoryFiles = Map<string, string>;

function memoryFiles(...paths: string[]): MemoryFiles {
  return new Map(paths.map((path) => [path, '']));
}

/** The directories that hold a file of `files`, each with the names directly inside it. */
function directoriesOf(files: MemoryFiles): Map<string, Map<string, boolean>> {
  const directories = new Map<string, Map<string, boolean>>();
  for (const file of files.keys()) {
    const segments = file.split('/').slice(1);
    for (let depth = 0; depth < segments.length; depth++) {
      const directory = `/${segments.slice(0, depth).join('/')}`.replace(/\/$/, '') || '/';
      const entries = directories.get(directory) ?? new Map<string, boolean>();
      entries.set(segments[depth]!, depth < segments.length - 1);
      directories.set(directory, entries);
    }
  }
  return directories;
}

/** A port over `files`. A file's stamp changes with its text's length. */
function memoryPort(files: MemoryFiles): ResRootsPort {
  return {
    pathCase: 'sensitive',
    async stat(path) {
      if (files.has(path)) return { isFile: true, mtimeMs: 1, size: files.get(path)!.length };
      return directoriesOf(files).has(path) ? { isFile: false, mtimeMs: 1, size: 0 } : null;
    },
    async realPath(directory) {
      return directoriesOf(files).has(directory) ? directory : null;
    },
    async list(directory) {
      const entries = directoriesOf(files).get(directory) ?? new Map<string, boolean>();
      return [...entries].map(([name, isDirectory]) => ({ name, isDirectory }));
    },
    async read(file) {
      return files.has(file) ? new TextEncoder().encode(files.get(file)!) : null;
    },
  };
}

/** The directory of the root of `scene`, a file the in-memory disk gains first. */
function rootDirOfScene(files: MemoryFiles, roots: ResRoots, scene: string): Promise<string | null> {
  files.set(scene, '');
  return rootDirOf(roots, scene);
}

describe('rootOf', () => {
  it("gives the nearest project.godot's directory for a scene below it", async () => {
    const files = memoryFiles('/work/game/project.godot');
    const roots = createResRoots(memoryPort(files), null);

    expect(await rootDirOfScene(files, roots, '/work/game/scenes/deep/level.tscn')).toBe('/work/game');
  });

  it('gives the nested project for a scene under a project inside a project', async () => {
    const files = memoryFiles('/work/game/project.godot', '/work/game/vendor/other/project.godot');
    const roots = createResRoots(memoryPort(files), null);

    expect(await rootDirOfScene(files, roots, '/work/game/vendor/other/scenes/a.tscn')).toBe(
      '/work/game/vendor/other'
    );
  });

  it("gives the scene's own directory for a loose scene inside the workspace", async () => {
    const files = memoryFiles();
    const roots = createResRoots(memoryPort(files), '/work');

    expect(await rootDirOfScene(files, roots, '/work/loose/dungeon/dungeon.tscn')).toBe(
      '/work/loose/dungeon'
    );
  });

  it('gives null for a loose scene outside the workspace, so no listing reads its whole directory', async () => {
    const roots = createResRoots(memoryPort(memoryFiles()), '/work/game');

    expect(await roots.rootOf('/work/loose/dungeon/dungeon.tscn')).toBeNull();
  });

  it('gives null for a loose scene with no workspace', async () => {
    const roots = createResRoots(memoryPort(memoryFiles()), null);

    expect(await roots.rootOf('/work/loose/dungeon.tscn')).toBeNull();
  });

  it('gives null for a path with no directory above it, as a filesystem root has none', async () => {
    const roots = createResRoots(memoryPort(memoryFiles()), '/');

    expect(await roots.rootOf('/')).toBeNull();
  });

  it('gives one root for every scene of a project, so what the root keeps serves the whole run', async () => {
    const roots = createResRoots(memoryPort(memoryFiles('/work/game/project.godot')), null);

    expect(await roots.rootOf('/work/game/scenes/level.tscn')).toBe(
      await roots.rootOf('/work/game/scenes/deep/level.tscn')
    );
  });
});

describe('rootOf with links', () => {
  it('gives one root for two spellings of a directory, so what the root keeps serves both', async () => {
    const files = memoryFiles('/work/game/project.godot');
    files.set('/work/game/a.tscn', '');
    const linked = withLinkTo(memoryPort(files), '/work/link', '/work/game');
    const roots = createResRoots(linked, '/work');

    expect(await roots.rootOf('/work/link/a.tscn')).toBe(await roots.rootOf('/work/game/a.tscn'));
  });
});

describe('workspaceRoot', () => {
  it('gives the project at or above the workspace', async () => {
    const files = memoryFiles('/work/project.godot');
    const roots = createResRoots(memoryPort(files), '/work/game');

    expect(await (await roots.workspaceRoot())?.resolve('res://project.godot')).toBe('/work/project.godot');
  });

  it('gives null when no project holds the workspace, which a loose root never fills', async () => {
    const roots = createResRoots(memoryPort(memoryFiles()), '/work/game');

    expect(await roots.workspaceRoot()).toBeNull();
  });

  it('gives null with no workspace', async () => {
    const roots = createResRoots(memoryPort(memoryFiles('/work/project.godot')), null);

    expect(await roots.workspaceRoot()).toBeNull();
  });
});

/** The root of `/work/game`, over `files` and a `project.godot` there, with a file outside the project beside it. */
async function gameRoot(files: MemoryFiles = memoryFiles()): Promise<ResRoot> {
  files.set('/work/game/project.godot', 'config_version=5\n');
  files.set('/work/secret.txt', 'outside the project');
  return (await createResRoots(memoryPort(files), null).rootOf('/work/game/scenes/level.tscn'))!;
}

describe('a root as a resource provider', () => {
  it('reads a text resource as a string', async () => {
    const root = await gameRoot(new Map([['/work/game/scenes/level.tscn', '[gd_scene format=3]\n']]));

    expect(await root.loadResource('res://scenes/level.tscn', 'PackedScene')).toBe('[gd_scene format=3]\n');
  });

  it('reads a binary resource as bytes', async () => {
    const root = await gameRoot(new Map([['/work/game/models/tree.glb', 'glTF']]));
    const data = await root.loadResource('res://models/tree.glb', 'PackedScene');

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(data as ArrayBuffer)).toBe('glTF');
  });

  it('gives null for a file the project does not hold', async () => {
    const root = await gameRoot();

    expect(await root.loadResource('res://models/missing.glb', 'PackedScene')).toBeNull();
  });

  it('refuses a path that escapes the root', async () => {
    const root = await gameRoot();

    expect(await root.loadResource('res://../secret.txt', 'TextFile')).toBeNull();
  });

  it('refuses a path that is not res://', async () => {
    const root = await gameRoot();

    expect(await root.loadResource('/work/secret.txt', 'TextFile')).toBeNull();
  });
});

describe('a root stamp', () => {
  it('is the modification time and size of the file', async () => {
    const root = await gameRoot(new Map([['/work/game/models/tree.glb', 'glTF']]));

    expect(await root.stamp('res://models/tree.glb')).toBe('1:4');
  });

  it('changes when the file is rewritten', async () => {
    const files = new Map([['/work/game/a.glb', '1']]);
    const root = await gameRoot(files);
    const before = await root.stamp('res://a.glb');
    files.set('/work/game/a.glb', '12');

    expect(await root.stamp('res://a.glb')).not.toBe(before);
  });

  it('gives null for a file the project does not hold', async () => {
    expect(await (await gameRoot()).stamp('res://missing.glb')).toBeNull();
  });

  it('gives null for a path that escapes the root', async () => {
    expect(await (await gameRoot()).stamp('res://../secret.txt')).toBeNull();
  });
});

describe('a root resolve', () => {
  it('gives the host path of a file the root holds', async () => {
    const root = await gameRoot(memoryFiles('/work/game/textures/floor.png'));

    expect(await root.resolve('res://textures/floor.png')).toBe('/work/game/textures/floor.png');
  });

  it('gives null for a file the root does not hold', async () => {
    expect(await (await gameRoot()).resolve('res://textures/floor.png')).toBeNull();
  });

  it('gives null for a directory, which no editor opens as a document', async () => {
    const root = await gameRoot(memoryFiles('/work/game/textures/floor.png'));

    expect(await root.resolve('res://textures')).toBeNull();
  });

  it('gives null for a path that escapes the root', async () => {
    expect(await (await gameRoot()).resolve('res://../secret.txt')).toBeNull();
  });
});

/** `port` where the directory `link` is a link to `target`: whatever lies under one lies under the other. */
function withLinkTo(port: ResRootsPort, link: string, target: string): ResRootsPort {
  const through = (path: string) =>
    path === link || path.startsWith(`${link}/`) ? `${target}${path.slice(link.length)}` : path;
  return {
    ...port,
    stat: (path) => port.stat(through(path)),
    realPath: (directory) => port.realPath(through(directory)),
    list: (directory) => port.list(through(directory)),
    read: (path) => port.read(through(path)),
  };
}

describe('a root listing', () => {
  /** A project whose files are the editor scan's cases: a data directory, a `.gdignore`, a nested project. */
  function listedFiles(): MemoryFiles {
    return memoryFiles(
      '/work/listed/project.godot',
      '/work/listed/scenes/level.tscn',
      '/work/listed/bin/a.gdextension',
      '/work/listed/addons/x/bin/B.GDExtension',
      '/work/listed/.godot/c.gdextension',
      '/work/listed/ignored/.gdignore',
      '/work/listed/ignored/d.gdextension',
      '/work/listed/nested/project.godot',
      '/work/listed/nested/e.gdextension'
    );
  }

  async function listedRoot(files: MemoryFiles, port = memoryPort(files)): Promise<ResRoot> {
    return (await createResRoots(port, null).rootOf('/work/listed/scenes/level.tscn'))!;
  }

  it("lists each GDExtension the editor's scan finds, in any case, and none it skips", async () => {
    const root = await listedRoot(listedFiles());

    expect(await root.listFiles('gdextension')).toEqual([
      'res://addons/x/bin/B.GDExtension',
      'res://bin/a.gdextension',
    ]);
  });

  it('lists every project file as a res:// path, sorted, and none the scan skips', async () => {
    const root = await listedRoot(listedFiles());

    expect(await root.listPaths()).toEqual([
      'res://addons/x/bin/B.GDExtension',
      'res://bin/a.gdextension',
      'res://project.godot',
      'res://scenes/level.tscn',
    ]);
  });

  it('ends a walk at a directory it has read before, reached again through a link', async () => {
    const files = memoryFiles(
      '/work/listed/project.godot',
      '/work/listed/addons/x/bin/B.GDExtension',
      '/work/listed/addons/x/loop/.link'
    );
    const root = await listedRoot(
      files,
      withLinkTo(memoryPort(files), '/work/listed/addons/x/loop', '/work/listed/addons')
    );

    expect(await root.listFiles('gdextension')).toEqual(['res://addons/x/bin/B.GDExtension']);
  });

  it('lists a root once until a change is reported, since a run sees one state of the project', async () => {
    const files = listedFiles();
    const roots = createResRoots(memoryPort(files), null);
    const root = (await roots.rootOf('/work/listed/scenes/level.tscn'))!;
    const first = await root.listPaths();
    files.set('/work/listed/models/late.glb', '');

    expect(await root.listPaths()).toEqual(first);
  });
});

describe('invalidate', () => {
  const SCENE = '/work/game/scenes/level.tscn';

  it('moves the root of a scene when a project.godot appears above it', async () => {
    const files = memoryFiles();
    const roots = createResRoots(memoryPort(files), '/work');
    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game/scenes');
    files.set('/work/game/project.godot', '');

    roots.invalidate('/work/game/project.godot');

    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game');
  });

  it("moves the root back to the scene's own directory when the project.godot is deleted", async () => {
    const files = memoryFiles('/work/game/project.godot');
    const roots = createResRoots(memoryPort(files), '/work');
    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game');
    files.delete('/work/game/project.godot');

    roots.invalidate('/work/game/project.godot');

    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game/scenes');
  });

  it('moves the root of a scene to a project.godot that appears between them', async () => {
    const files = memoryFiles('/work/game/project.godot');
    const roots = createResRoots(memoryPort(files), '/work');
    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game');
    files.set('/work/game/scenes/project.godot', '');

    roots.invalidate('/work/game/scenes/project.godot');

    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game/scenes');
  });

  it('keeps every answer a change cannot affect', async () => {
    const files = memoryFiles();
    const roots = createResRoots(memoryPort(files), '/work');
    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game/scenes');
    files.set('/work/game/project.godot', '');

    roots.invalidate('/work/other/project.godot');

    expect(await rootDirOfScene(files, roots, SCENE)).toBe('/work/game/scenes');
  });

  it('lists a file created under a root, and keeps the listing of a root it is not under', async () => {
    const files = memoryFiles('/work/a/project.godot', '/work/b/project.godot');
    const roots = createResRoots(memoryPort(files), null);
    const rootA = (await roots.rootOf('/work/a/s.tscn'))!;
    const rootB = (await roots.rootOf('/work/b/s.tscn'))!;
    await Promise.all([rootA.listPaths(), rootB.listPaths()]);
    files.set('/work/a/late.png', '');
    files.set('/work/b/late.png', '');

    roots.invalidate('/work/a/late.png');

    expect(await rootA.listPaths()).toContain('res://late.png');
    expect(await rootB.listPaths()).not.toContain('res://late.png');
  });

  it('drops the listing of a root when a file changes under the other spelling of its directory', async () => {
    const files = memoryFiles('/work/game/project.godot');
    const linked = withLinkTo(memoryPort(files), '/work/link', '/work/game');
    const roots = createResRoots(linked, '/work');
    const root = (await roots.rootOf('/work/link/s.tscn'))!;
    expect(await root.listPaths()).not.toContain('res://late.png');
    files.set('/work/game/late.png', '');

    roots.invalidate('/work/game/late.png');

    expect(await root.listPaths()).toContain('res://late.png');
  });

  it('keeps the listing of a root when a file changes under a dot-named directory, which the scan never enters', async () => {
    const files = memoryFiles('/work/game/project.godot');
    const roots = createResRoots(memoryPort(files), null);
    const root = (await roots.rootOf('/work/game/s.tscn'))!;
    const listed = await root.listPaths();
    files.set('/work/game/.git/objects/late', '');

    roots.invalidate('/work/game/.git/objects/late');

    expect(await root.listPaths()).toBe(listed);
  });

  it('drops the listing of a root when a file changes in a directory a link leads to outside it', async () => {
    const files = memoryFiles('/work/game/project.godot', '/work/shared/old.png');
    files.set('/work/game/art/.link', '');
    const port = withLinkTo(memoryPort(files), '/work/game/art', '/work/shared');
    const roots = createResRoots(port, null);
    const root = (await roots.rootOf('/work/game/s.tscn'))!;
    expect(await root.listPaths()).not.toContain('res://art/late.png');
    files.set('/work/shared/late.png', '');

    roots.invalidate('/work/shared/late.png');

    expect(await root.listPaths()).toContain('res://art/late.png');
  });

  it('drops the listing when a .gdignore appears, though its own name starts with a dot', async () => {
    const files = memoryFiles('/work/game/project.godot', '/work/game/art/a.png');
    const roots = createResRoots(memoryPort(files), null);
    const root = (await roots.rootOf('/work/game/s.tscn'))!;
    expect(await root.listPaths()).toContain('res://art/a.png');
    files.set('/work/game/art/.gdignore', '');

    roots.invalidate('/work/game/art/.gdignore');

    expect(await root.listPaths()).not.toContain('res://art/a.png');
  });

  it('leaves out a nested project once its project.godot appears', async () => {
    const files = memoryFiles('/work/game/project.godot', '/work/game/vendor/other/nested.tscn');
    const roots = createResRoots(memoryPort(files), null);
    const root = (await roots.rootOf('/work/game/s.tscn'))!;
    expect(await root.listPaths()).toContain('res://vendor/other/nested.tscn');
    files.set('/work/game/vendor/other/project.godot', '');

    roots.invalidate('/work/game/vendor/other/project.godot');

    expect(await root.listPaths()).not.toContain('res://vendor/other/nested.tscn');
  });

  it('keeps the root a scene had, as one object, across a change in its listing', async () => {
    const files = memoryFiles('/work/game/project.godot');
    const roots = createResRoots(memoryPort(files), null);
    const before = await roots.rootOf('/work/game/s.tscn');

    roots.invalidate('/work/game/late.png');

    expect(await roots.rootOf('/work/game/s.tscn')).toBe(before);
  });
});

describe('invalidateAll', () => {
  it('drops the roots and the listings alike', async () => {
    const files = memoryFiles();
    const roots = createResRoots(memoryPort(files), '/work');
    const loose = (await roots.rootOf('/work/game/scenes/level.tscn'))!;
    await loose.listPaths();
    files.set('/work/game/project.godot', '');
    files.set('/work/game/scenes/late.png', '');

    roots.invalidateAll();

    expect(await rootDirOfScene(files, roots, '/work/game/scenes/level.tscn')).toBe('/work/game');
    expect(await loose.listPaths()).toContain('res://late.png');
  });
});
