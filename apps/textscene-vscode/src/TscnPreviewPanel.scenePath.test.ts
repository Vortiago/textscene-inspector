import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { createMockUri, type MockWebview } from './test-setup';
import { openReadyPreviewPanel } from './previewPanel.testkit';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

function loadedScenePaths(webview: MockWebview): unknown[] {
  return webview.postMessage.mock.calls
    .map((call) => call[0] as { type: string; scenePath?: unknown })
    .filter((message) => message.type === 'loadTscn')
    .map((message) => message.scenePath);
}

/** Finds `project.godot` in `/workspace` only. Every other file exists. */
function projectFileInWorkspace(): void {
  (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
    !uri.fsPath.endsWith('/project.godot') || uri.fsPath === '/workspace/project.godot'
      ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 })
      : Promise.reject(new Error('Not found'))
  );
}

describe('TscnPreviewPanel scene path', () => {
  it("posts the document's res:// path with its text, which a sub-resource path names", async () => {
    projectFileInWorkspace();
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({ uri: createMockUri('/workspace') });
    const { webview } = await openReadyPreviewPanel(MINIMAL_TSCN, '/workspace/levels/main.tscn');

    expect(loadedScenePaths(webview)).toEqual(['res://levels/main.tscn']);
  });

  it('posts no path for a document outside every workspace folder, which has no res:// root', async () => {
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);
    const { webview } = await openReadyPreviewPanel(MINIMAL_TSCN, '/elsewhere/main.tscn');

    expect(loadedScenePaths(webview)).toEqual([null]);
  });
});
