/**
 * Tests for findGodotProjectRoot: the shared "walk up looking for
 * project.godot, fall back to the workspace root" resolution used by both
 * VSCodeResourceProvider (loading resource bytes) and TscnDocumentLinkProvider
 * (resolving `res://` document links) so they never disagree on where a
 * `res://` path points.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { findGodotProjectRoot } from './findGodotProjectRoot';
import { createMockUri, vscode } from './test-setup';

describe('findGodotProjectRoot', () => {
  let workspaceRoot: ReturnType<typeof createMockUri>;

  beforeEach(() => {
    workspaceRoot = createMockUri('/workspace');
  });

  it('finds project.godot in the document\'s own directory', async () => {
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
