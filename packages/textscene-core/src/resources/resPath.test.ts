import { describe, expect, it } from 'vitest';
import {
  comparablePath,
  findProjectRoot,
  findResRoot,
  isWithinRoot,
  normalizeRelativePath,
  parentDir,
  pathCaseOf,
  projectFileIn,
  resRelativePath,
  resolveResPath,
} from './resPath';

/** A `hasProjectFile` over a fixed set of directories that hold a `project.godot`. */
function projectsAt(...dirs: string[]): (dir: string) => Promise<boolean> {
  return async (dir) => dirs.includes(dir);
}

describe('comparablePath', () => {
  it('trims trailing slashes in linear time, however many slashes the path holds', () => {
    // A backtracking `/\/+$/` spends about 3 s on this path, which a host passes unchecked.
    const manySlashes = `${'/'.repeat(100_000)}a`;
    const startedAt = performance.now();
    expect(comparablePath(`${manySlashes}///`)).toBe(manySlashes);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it('turns backslashes into forward slashes and lowers the case', () => {
    expect(comparablePath('C:\\Users\\Me\\Proj')).toBe('c:/users/me/proj');
  });
});

describe('isWithinRoot', () => {
  it('holds the root itself and every path under it', () => {
    expect(isWithinRoot('/proj', '/proj', 'sensitive')).toBe(true);
    expect(isWithinRoot('/proj', '/proj/scenes/a.tscn', 'sensitive')).toBe(true);
  });

  it('refuses a sibling whose name only starts with the root', () => {
    expect(isWithinRoot('/proj', '/proj-other/a.tscn', 'sensitive')).toBe(false);
  });

  it('refuses a sibling whose name differs from the root only in case, on a case-sensitive filesystem', () => {
    expect(isWithinRoot('/w/Game', '/w/game/secret.txt', 'sensitive')).toBe(false);
  });

  it('compares Windows drive letters and separators case-insensitively', () => {
    expect(isWithinRoot('C:\\Proj', 'c:/proj/Scenes/a.tscn', 'insensitive')).toBe(true);
    expect(isWithinRoot('c:/', 'C:\\proj', 'insensitive')).toBe(true);
  });

  it('reads backslashes as separators on a case-sensitive filesystem too', () => {
    expect(isWithinRoot('/w/Game', '/w/Game\\scenes\\a.tscn', 'sensitive')).toBe(true);
  });
});

describe('pathCaseOf', () => {
  it('ignores case on Windows and macOS, whose default filesystems do', () => {
    expect(pathCaseOf('win32')).toBe('insensitive');
    expect(pathCaseOf('darwin')).toBe('insensitive');
  });

  it('counts case on Linux', () => {
    expect(pathCaseOf('linux')).toBe('sensitive');
  });

  it('counts case on an unknown platform, such as a web worker with no process', () => {
    expect(pathCaseOf(undefined)).toBe('sensitive');
  });
});

describe('normalizeRelativePath', () => {
  it('drops empty and "." segments and folds ".." into its parent', () => {
    expect(normalizeRelativePath('a//./b/../c.glb')).toBe('a/c.glb');
  });

  it('reads backslashes as separators', () => {
    expect(normalizeRelativePath('models\\tree.glb')).toBe('models/tree.glb');
  });

  it('gives null for a path that climbs above its start', () => {
    expect(normalizeRelativePath('../secret')).toBeNull();
    expect(normalizeRelativePath('a/../../secret')).toBeNull();
  });
});

describe('resolveResPath', () => {
  it('maps a res:// path onto the project root', () => {
    expect(resolveResPath('/home/me/proj', 'res://models/tree.glb')).toBe('/home/me/proj/models/tree.glb');
  });

  it('joins onto a Windows root with forward slashes', () => {
    expect(resolveResPath('C:\\Games\\Proj', 'res://models/tree.glb')).toBe('C:/Games/Proj/models/tree.glb');
  });

  it('joins onto a filesystem root without a doubled separator', () => {
    expect(resolveResPath('/', 'res://tree.glb')).toBe('/tree.glb');
  });

  it('gives null for a path that escapes the root', () => {
    expect(resolveResPath('/proj', 'res://../proj-other/key.pem')).toBeNull();
  });

  it('gives null for a path that is not res://', () => {
    expect(resolveResPath('/proj', 'models/tree.glb')).toBeNull();
    expect(resolveResPath('/proj', 'user://save.tres')).toBeNull();
  });
});

describe('resRelativePath', () => {
  it('gives a res:// path relative to its project root', () => {
    expect(resRelativePath('res://models/./tree.glb')).toBe('models/tree.glb');
  });

  it('gives null for a path that escapes the root or is not res://', () => {
    expect(resRelativePath('res://../secret')).toBeNull();
    expect(resRelativePath('models/tree.glb')).toBeNull();
  });
});

describe('parentDir', () => {
  it('gives the directory holding a path, with forward slashes', () => {
    expect(parentDir('/proj/scenes/')).toBe('/proj');
    expect(parentDir('C:\\Games\\Proj')).toBe('C:/Games');
  });

  it('gives the filesystem root above a top-level directory', () => {
    expect(parentDir('/proj')).toBe('/');
    expect(parentDir('C:\\Games')).toBe('C:/');
  });

  it('gives null at a filesystem root and for a bare name', () => {
    expect(parentDir('/')).toBeNull();
    expect(parentDir('c:/')).toBeNull();
    expect(parentDir('proj')).toBeNull();
  });
});

/** An upward walk over string paths that `isStop` ends. */
function walk(
  start: string,
  hasProjectFile: (dir: string) => Promise<boolean>,
  isStop = (_dir: string) => false
) {
  return findProjectRoot(start, parentDir, isStop, hasProjectFile);
}

describe('findProjectRoot', () => {
  it('finds project.godot in the start directory', async () => {
    expect(await walk('/proj/scenes', projectsAt('/proj/scenes', '/proj'))).toBe('/proj/scenes');
  });

  it('walks up to the nearest ancestor holding project.godot', async () => {
    expect(await walk('/proj/scenes/deep', projectsAt('/proj'))).toBe('/proj');
  });

  it('walks a Windows path up to its drive root', async () => {
    expect(await walk('C:\\Games\\Proj\\scenes', projectsAt('C:/'))).toBe('C:/');
  });

  it('gives null when no ancestor holds project.godot', async () => {
    expect(await walk('/proj/scenes', projectsAt())).toBeNull();
  });

  it('checks the stop directory, then ends, even with project.godot above it', async () => {
    const asked: string[] = [];
    const hasProjectFile = async (dir: string) => {
      asked.push(dir);
      return dir === '/';
    };
    expect(await walk('/ws/scenes', hasProjectFile, (dir) => dir === '/ws')).toBeNull();
    expect(asked).toEqual(['/ws/scenes', '/ws']);
  });

  it('finds project.godot in the stop directory itself', async () => {
    expect(await walk('/ws/scenes', projectsAt('/ws'), (dir) => dir === '/ws')).toBe('/ws');
  });

  it('walks any directory handle its parent step understands', async () => {
    interface Dir {
      name: string;
      up: Dir | null;
    }
    const deep: Dir = { name: 'deep', up: { name: 'proj', up: null } };
    const root = await findProjectRoot(
      deep,
      (dir) => dir.up,
      () => false,
      async (dir) => dir.name === 'proj'
    );
    expect(root?.name).toBe('proj');
  });
});

describe('findResRoot', () => {
  const inWorkspace = () => true;
  const outsideWorkspace = () => false;

  it('gives the project root when an ancestor holds project.godot', async () => {
    expect(
      await findResRoot('/proj/scenes', parentDir, () => false, projectsAt('/proj'), outsideWorkspace)
    ).toBe('/proj');
  });

  it("gives the scene's own directory when no ancestor holds project.godot", async () => {
    expect(await findResRoot('/demo/dungeon', parentDir, () => false, projectsAt(), inWorkspace)).toBe(
      '/demo/dungeon'
    );
  });

  it("gives the scene's own directory when the only project.godot lies above the stop directory", async () => {
    const isStop = (dir: string) => dir === '/ws';
    expect(await findResRoot('/ws/scenes', parentDir, isStop, projectsAt('/'), inWorkspace)).toBe(
      '/ws/scenes'
    );
  });

  it('gives null for a loose scene outside the workspace', async () => {
    expect(await findResRoot('/tmp', parentDir, () => false, projectsAt(), outsideWorkspace)).toBeNull();
  });
});

describe('projectFileIn', () => {
  it('names the project.godot a directory holds', () => {
    expect(projectFileIn('C:\\Games\\Proj\\')).toBe('C:/Games/Proj/project.godot');
    expect(projectFileIn('/')).toBe('/project.godot');
  });
});
