/**
 * Unit tests for dependency hot-reload.
 *
 * Bug: editing a scene dependency (texture, `.tres`, instanced sub-scene) never
 * refreshed the preview — the watcher re-read the unchanged main `.tscn`, whose
 * content-diff guard then no-oped. The fix pushes a `resourceChanged` message so
 * the webview re-fetches just that resource, independent of the main-scene text.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

async function createReadyPanel(
  triggerMessage: (msg: { type: string }) => void
): Promise<TscnPreviewPanel> {
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
  const panel = TscnPreviewPanel.create(
    createMockUri('/extension'),
    createMockUri('/workspace/scene.tscn')
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  triggerMessage({ type: 'webviewReady' });
  return panel;
}

function resourceChangedCalls(webview: MockWebview): unknown[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0])
    .filter((m) => (m as { type: string }).type === 'resourceChanged');
}

describe('TscnPreviewPanel dependency hot-reload', () => {
  it('posts resourceChanged for a dependency even though the main scene is unchanged', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);

    // The main .tscn content never changed — the loadTscn path would no-op here.
    panel.invalidateResource('res://textures/wood.png');

    const calls = resourceChangedCalls(webview);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ type: 'resourceChanged', path: 'res://textures/wood.png' });
  });

  it('does not post before the webview handshake (it will load fresh anyway)', async () => {
    const { webview } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    const panel = TscnPreviewPanel.create(
      createMockUri('/extension'),
      createMockUri('/workspace/scene.tscn')
    );
    await new Promise<void>((r) => setTimeout(r, 10));
    // No webviewReady triggered.

    panel.invalidateResource('res://textures/wood.png');

    expect(resourceChangedCalls(webview)).toHaveLength(0);
  });

  it('resolves a changed dependency file to its res:// path and posts resourceChanged', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage); // main scene: /workspace/scene.tscn
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    // fs.stat resolves by default, so findProjectRoot treats /workspace as the root.

    await panel.handleDependencyChange(createMockUri('/workspace/textures/wood.png'));

    expect(resourceChangedCalls(webview)).toEqual([
      { type: 'resourceChanged', path: 'res://textures/wood.png' },
    ]);
  });

  it('skips resolution IO entirely when the webview is not ready', async () => {
    const { webview } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    const panel = TscnPreviewPanel.create(
      createMockUri('/extension'),
      createMockUri('/workspace/scene.tscn')
    );
    await new Promise<void>((r) => setTimeout(r, 10));
    // No webviewReady triggered.
    const getWorkspaceFolder = vscode.workspace.getWorkspaceFolder as Mock;

    await panel.handleDependencyChange(createMockUri('/workspace/textures/wood.png'));

    expect(getWorkspaceFolder).not.toHaveBeenCalled();
    expect(resourceChangedCalls(webview)).toHaveLength(0);
  });
});
