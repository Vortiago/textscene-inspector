/**
 * Unit tests for the preview's `res://` root: the nearest `project.godot`, or the scene's own
 * directory outside every project, as the editor features resolve it. When a `project.godot`
 * created, moved or deleted while a preview is open moves the root, the panel drops its cached
 * provider and has the webview re-fetch every resource it served.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { forgetProjectFiles } from './resRoot';
import { createMockUri, type MockWebview } from './test-setup';
import { openReadyPreviewPanel, settle } from './previewPanel.testkit';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
const SCENE = '/workspace/game/scene.tscn';

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
async function openPanelServingTexture() {
  (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({ uri: createMockUri('/workspace') });
  const opened = await openReadyPreviewPanel(MINIMAL_TSCN, SCENE);
  opened.triggerMessage({
    type: 'loadResource',
    path: 'res://textures/wood.png',
    resourceType: 'Texture2D',
    requestId: 'r1',
  });
  await settle();
  return opened;
}

/** A `project.godot` event as the extension relays it: its own listener forgets the shared answers first. */
async function projectFileEvent(panel: TscnPreviewPanel, fsPath: string): Promise<void> {
  forgetProjectFiles();
  await panel.handleDependencyChange(createMockUri(fsPath));
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

describe('TscnPreviewPanel res:// root', () => {
  it("reads a loose scene's res:// path under the scene's own directory, not the workspace root", async () => {
    projectFilesIn();
    const { triggerMessage } = await openPanelServingTexture();

    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/game/textures/wood.png'
    );
  });

  it('re-fetches every served resource under a project.godot created above a loose scene', async () => {
    projectFilesIn();
    const { webview, triggerMessage, panel } = await openPanelServingTexture();
    projectFilesIn('/workspace');

    await projectFileEvent(panel, '/workspace/project.godot');

    expect(changedPaths(webview)).toEqual(['res://textures/wood.png']);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/textures/wood.png'
    );
  });

  it("falls back to the scene's own directory once the project.godot is deleted", async () => {
    projectFilesIn('/workspace');
    const { webview, triggerMessage, panel } = await openPanelServingTexture();
    projectFilesIn();

    await projectFileEvent(panel, '/workspace/project.godot');

    expect(changedPaths(webview)).toEqual(['res://textures/wood.png']);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/game/textures/wood.png'
    );
  });

  it('keeps the provider and re-fetches nothing for a project.godot that moves no root', async () => {
    projectFilesIn('/workspace/game');
    const { webview, triggerMessage, panel } = await openPanelServingTexture();
    projectFilesIn('/workspace/game', '/workspace/other');

    await projectFileEvent(panel, '/workspace/other/project.godot');

    expect(changedPaths(webview)).toEqual([]);
    expect(await fsPathOfNextLoad(triggerMessage, 'res://textures/wood.png')).toBe(
      '/workspace/game/textures/wood.png'
    );
  });

  it('treats a file only named like project.godot as an ordinary dependency', async () => {
    projectFilesIn();
    const { webview, panel } = await openPanelServingTexture();
    projectFilesIn('/workspace/game');

    await panel.handleDependencyChange(createMockUri('/workspace/game/project.godot.bak'));

    expect(changedPaths(webview)).toEqual([]);
  });
});
