/**
 * Unit tests for a `project.godot` that is created, moved or deleted while a preview
 * is open. Its directory is the `res://` root, so when the root moves the panel
 * drops its cached provider and has the webview re-fetch every resource it served.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
const SCENE = '/workspace/game/scene.tscn';

const settle = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 10));

/** Finds `project.godot` in exactly these directories. Every other file exists. */
function projectFilesIn(...dirs: string[]): void {
  (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) => {
    const isProjectFile = uri.fsPath.endsWith('/project.godot');
    return !isProjectFile || dirs.some((dir) => uri.fsPath === `${dir}/project.godot`)
      ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 })
      : Promise.reject(new Error('Not found'));
  });
}

/** A ready panel on `SCENE` that has served `res://textures/wood.png`. */
async function createPanelServingTexture(triggerMessage: (msg: unknown) => void): Promise<TscnPreviewPanel> {
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
  (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({ uri: createMockUri('/workspace') });
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri(SCENE));
  await settle();
  triggerMessage({ type: 'webviewReady' });
  triggerMessage({
    type: 'loadResource',
    path: 'res://textures/wood.png',
    resourceType: 'Texture2D',
    requestId: 'r1',
  });
  await settle();
  return panel;
}

function changedPaths(webview: MockWebview): string[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0] as { type: string; path?: string })
    .filter((m) => m.type === 'resourceChanged')
    .map((m) => m.path as string);
}

/** The fsPath of the next read, once the webview requests `resPath` again. */
async function fsPathOfNextLoad(triggerMessage: (msg: unknown) => void, resPath: string): Promise<string> {
  const readFile = vscode.workspace.fs.readFile as Mock;
  readFile.mockClear();
  triggerMessage({ type: 'loadResource', path: resPath, resourceType: 'Texture2D', requestId: 'r2' });
  await settle();
  return (readFile.mock.calls[0]?.[0] as vscode.Uri).fsPath;
}

describe('TscnPreviewPanel project root move', () => {
  it('re-fetches every served resource under a project.godot created after the preview opened', async () => {
    projectFilesIn();
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createPanelServingTexture(triggerMessage);
    projectFilesIn('/workspace/game');

    await panel.handleDependencyChange(createMockUri('/workspace/game/project.godot'));

    expect(changedPaths(webview)).toEqual(['res://textures/wood.png']);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/game/textures/wood.png'
    );
  });

  it('falls back to the workspace root once the project.godot is deleted', async () => {
    projectFilesIn('/workspace/game');
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createPanelServingTexture(triggerMessage);
    projectFilesIn();

    await panel.handleDependencyChange(createMockUri('/workspace/game/project.godot'));

    expect(changedPaths(webview)).toEqual(['res://textures/wood.png']);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/textures/wood.png'
    );
  });

  it('keeps the provider and re-fetches nothing for a project.godot that moves no root', async () => {
    projectFilesIn('/workspace/game');
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createPanelServingTexture(triggerMessage);
    projectFilesIn('/workspace/game', '/workspace/other');

    await panel.handleDependencyChange(createMockUri('/workspace/other/project.godot'));

    expect(changedPaths(webview)).toEqual([]);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/game/textures/wood.png'
    );
  });

  it('treats a file only named like project.godot as an ordinary dependency', async () => {
    projectFilesIn();
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createPanelServingTexture(triggerMessage);
    projectFilesIn('/workspace/game');

    await panel.handleDependencyChange(createMockUri('/workspace/game/project.godot.bak'));

    expect(changedPaths(webview)).toEqual([]);
  });
});
