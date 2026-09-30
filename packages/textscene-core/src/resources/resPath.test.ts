import { describe, expect, it } from 'vitest';
import {
  comparablePath,
  findProjectRoot,
  isWithinRoot,
  normalizeRelativePath,
  projectFileIn,
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
    expect(isWithinRoot('/proj', '/proj')).toBe(true);
    expect(isWithinRoot('/proj', '/proj/scenes/a.tscn')).toBe(true);
  });

  it('refuses a sibling whose name only starts with the root', () => {
    expect(isWithinRoot('/proj', '/proj-other/a.tscn')).toBe(false);
  });

  it('compares Windows drive letters and separators case-insensitively', () => {
    expect(isWithinRoot('C:\\Proj', 'c:/proj/Scenes/a.tscn')).toBe(true);
    expect(isWithinRoot('c:/', 'C:\\proj')).toBe(true);
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

describe('findProjectRoot', () => {
  it('finds project.godot in the start directory', async () => {
    expect(await findProjectRoot('/proj/scenes', null, projectsAt('/proj/scenes', '/proj'))).toBe('/proj/scenes');
  });

  it('walks up to the nearest ancestor holding project.godot', async () => {
    expect(await findProjectRoot('/proj/scenes/deep', null, projectsAt('/proj'))).toBe('/proj');
  });

  it('walks a Windows path up to its drive root', async () => {
    expect(await findProjectRoot('C:\\Games\\Proj\\scenes', null, projectsAt('C:/'))).toBe('C:/');
  });

  it('gives null when no ancestor holds project.godot', async () => {
    expect(await findProjectRoot('/proj/scenes', null, projectsAt())).toBeNull();
  });

  it('stops at the stop directory, even with project.godot above it', async () => {
    expect(await findProjectRoot('/ws/scenes', '/ws', projectsAt('/'))).toBeNull();
  });

  it('checks the stop directory itself, compared case-insensitively', async () => {
    expect(await findProjectRoot('/WS/scenes', '/ws', projectsAt('/WS'))).toBe('/WS');
  });

  it('checks only the start directory when it lies outside the stop directory', async () => {
    const asked: string[] = [];
    const hasProjectFile = async (dir: string) => {
      asked.push(dir);
      return false;
    };
    expect(await findProjectRoot('/elsewhere/scenes', '/ws', hasProjectFile)).toBeNull();
    expect(asked).toEqual(['/elsewhere/scenes']);
  });

  it('does not stop at a sibling whose name only starts with the stop directory', async () => {
    expect(await findProjectRoot('/ws-other/scenes', '/ws', projectsAt('/ws-other'))).toBeNull();
  });
});

describe('projectFileIn', () => {
  it('names the project.godot a directory holds', () => {
    expect(projectFileIn('C:\\Games\\Proj\\')).toBe('C:/Games/Proj/project.godot');
    expect(projectFileIn('/')).toBe('/project.godot');
  });
});
