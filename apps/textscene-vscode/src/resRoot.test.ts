/**
 * Tests for the `res://` root walk: up from a document for project.godot, bounded by the workspace root, with the
 * document's own directory outside every project.
 */

import { describe, it, expect, vi } from 'vitest';
import { findResRootIn, hasProjectFile, resRootOf } from './resRoot';
import { createMockUri, vscode } from './test-setup';

describe('findResRootIn', () => {
  const workspaceRoot = createMockUri('/workspace');

  it('gives the nearest directory that holds project.godot', async () => {
    const holds = async (dir: ReturnType<typeof createMockUri>) => dir.fsPath === '/workspace/game';

    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/workspace/game/scenes/Door.tscn'),
      holds
    );

    expect(result?.fsPath).toBe('/workspace/game');
  });

  it("gives the document's own directory when no directory holds project.godot", async () => {
    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/workspace/isometric/dungeon.tscn'),
      async () => false
    );

    expect(result?.fsPath).toBe('/workspace/isometric');
  });

  it("gives the document's own directory when the only project.godot lies above the workspace root", async () => {
    const holds = async (dir: ReturnType<typeof createMockUri>) => dir.fsPath === '/';

    const result = await findResRootIn(workspaceRoot, createMockUri('/workspace/scenes/Door.tscn'), holds);

    expect(result?.fsPath).toBe('/workspace/scenes');
  });

  it('gives null for a document outside the workspace root', async () => {
    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/elsewhere/dungeon.tscn'),
      async () => false
    );

    expect(result).toBeNull();
  });

  it('walks upward to the project.godot an ancestor directory holds, through stat', async () => {
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) =>
      uri.fsPath === '/workspace/project.godot'
        ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 })
        : Promise.reject(new Error('Not found'))
    );

    const result = await findResRootIn(
      workspaceRoot,
      createMockUri('/workspace/scenes/nested/deep/Door.tscn')
    );

    expect(result?.fsPath).toBe('/workspace');
  });

  it('asks about each directory from the document up to the workspace root, and none above it', async () => {
    const asked: string[] = [];
    const holds = async (dir: ReturnType<typeof createMockUri>) => {
      asked.push(dir.fsPath);
      return false;
    };

    await findResRootIn(workspaceRoot, createMockUri('/workspace/a/b/Door.tscn'), holds);

    expect(asked).toEqual(['/workspace/a/b', '/workspace/a', '/workspace']);
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
