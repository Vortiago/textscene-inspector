/**
 * Tests for the project walk: up from a document for project.godot, with the
 * workspace-root fallback the preview takes, and the document-directory fallback
 * the editor features take.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findEnclosingGodotProject,
  findGodotProjectRoot,
  findResRootIn,
  hasProjectFile,
  resRootOf,
} from './findGodotProjectRoot';
import { createMockUri, vscode } from './test-setup';

describe('findGodotProjectRoot', () => {
  let workspaceRoot: ReturnType<typeof createMockUri>;

  beforeEach(() => {
    workspaceRoot = createMockUri('/workspace');
  });

  it("finds project.godot in the document's own directory", async () => {
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
      const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
      if (path === '/workspace/scenes/project.godot') {
        return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 });
      }
      return Promise.reject(new Error('Not found'));
    });

    const documentUri = createMockUri('/workspace/scenes/Door.tscn');
    const result = await findGodotProjectRoot(workspaceRoot, documentUri);

    expect(result.fsPath).toBe('/workspace/scenes');
  });

  it('walks upward until it finds project.godot in an ancestor directory', async () => {
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
      const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
      if (path === '/workspace/project.godot') {
        return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 });
      }
      return Promise.reject(new Error('Not found'));
    });

    const documentUri = createMockUri('/workspace/scenes/nested/deep/Door.tscn');
    const result = await findGodotProjectRoot(workspaceRoot, documentUri);

    expect(result.fsPath).toBe('/workspace');
  });

  it('falls back to the workspace root when no project.godot exists anywhere', async () => {
    vscode.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    const documentUri = createMockUri('/workspace/scenes/nested/Door.tscn');
    const result = await findGodotProjectRoot(workspaceRoot, documentUri);

    expect(result.fsPath).toBe('/workspace');
  });

  it('falls back to the workspace root when the document lives outside it', async () => {
    vscode.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    const documentUri = createMockUri('/elsewhere/Door.tscn');
    const result = await findGodotProjectRoot(workspaceRoot, documentUri);

    expect(result.fsPath).toBe('/workspace');
  });

  it('stops at the workspace root itself even if project.godot lives above it', async () => {
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
      const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
      if (path === '/project.godot') {
        return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 });
      }
      return Promise.reject(new Error('Not found'));
    });

    const documentUri = createMockUri('/workspace/scenes/Door.tscn');
    const result = await findGodotProjectRoot(workspaceRoot, documentUri);

    expect(result.fsPath).toBe('/workspace');
  });
});

describe('findEnclosingGodotProject', () => {
  const workspaceRoot = createMockUri('/workspace');

  it('finds the nearest directory that holds project.godot', async () => {
    const holds = async (dir: ReturnType<typeof createMockUri>) => dir.fsPath === '/workspace/game';

    const result = await findEnclosingGodotProject(
      workspaceRoot,
      createMockUri('/workspace/game/scenes/Door.tscn'),
      holds
    );

    expect(result?.fsPath).toBe('/workspace/game');
  });

  it('gives null, not the workspace root, when no directory holds project.godot', async () => {
    const result = await findEnclosingGodotProject(
      workspaceRoot,
      createMockUri('/workspace/scenes/Door.tscn'),
      async () => false
    );

    expect(result).toBeNull();
  });

  it('asks about each directory from the document up to the workspace root, and none above it', async () => {
    const asked: string[] = [];
    const holds = async (dir: ReturnType<typeof createMockUri>) => {
      asked.push(dir.fsPath);
      return false;
    };

    await findEnclosingGodotProject(workspaceRoot, createMockUri('/workspace/a/b/Door.tscn'), holds);

    expect(asked).toEqual(['/workspace/a/b', '/workspace/a', '/workspace']);
  });
});

describe('findResRootIn', () => {
  const workspaceRoot = createMockUri('/workspace');

  it('gives the nearest directory that holds project.godot', async () => {
    const holds = async (dir: ReturnType<typeof createMockUri>) => dir.fsPath === '/workspace/game';

    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/workspace/game/scenes/Door.tscn'),
      holds
    );

    expect(result.fsPath).toBe('/workspace/game');
  });

  it("gives the document's own directory when no directory holds project.godot", async () => {
    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/workspace/isometric/dungeon.tscn'),
      async () => false
    );

    expect(result.fsPath).toBe('/workspace/isometric');
  });

  it("gives the document's own directory when the only project.godot lies above the workspace root", async () => {
    const holds = async (dir: ReturnType<typeof createMockUri>) => dir.fsPath === '/';

    const result = await findResRootIn(workspaceRoot, createMockUri('/workspace/scenes/Door.tscn'), holds);

    expect(result.fsPath).toBe('/workspace/scenes');
  });
});

describe('resRootOf', () => {
  const inWorkspace = () =>
    (vscode.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

  it('gives the project root for a document inside a project', async () => {
    inWorkspace();
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) =>
      uri.fsPath === '/workspace/project.godot'
        ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
        : Promise.reject(new Error('Not found'))
    );

    expect((await resRootOf(createMockUri('/workspace/scenes/Door.tscn')))?.fsPath).toBe('/workspace');
  });

  it("gives the document's own directory outside every project", async () => {
    inWorkspace();
    vscode.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    expect((await resRootOf(createMockUri('/workspace/isometric/dungeon.tscn')))?.fsPath).toBe(
      '/workspace/isometric'
    );
  });

  it('gives null outside every workspace folder', async () => {
    (vscode.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    expect(await resRootOf(createMockUri('/elsewhere/Door.tscn'))).toBeNull();
  });
});

describe('hasProjectFile', () => {
  it('is true when stat finds project.godot in the directory', async () => {
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) =>
      uri.fsPath === '/workspace/project.godot'
        ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
        : Promise.reject(new Error('Not found'))
    );

    expect(await hasProjectFile(createMockUri('/workspace'))).toBe(true);
  });

  it('is false when stat rejects', async () => {
    vscode.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    expect(await hasProjectFile(createMockUri('/workspace'))).toBe(false);
  });
});
