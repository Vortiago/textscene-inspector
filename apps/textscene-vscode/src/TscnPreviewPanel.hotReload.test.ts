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

    // Establish relevance: the webview must have requested this resource at
    // least once before a disk change to it is considered worth invalidating.
    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://textures/wood.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    await panel.handleDependencyChange(createMockUri('/workspace/textures/wood.png'));

    expect(resourceChangedCalls(webview)).toEqual([
      { type: 'resourceChanged', path: 'res://textures/wood.png' },
    ]);
  });

  it('does not post resourceChanged for a file the scene never requested (relevance gate)', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    // No loadResource message was ever sent for this path.
    await panel.handleDependencyChange(createMockUri('/workspace/unrelated.png'));

    expect(resourceChangedCalls(webview)).toHaveLength(0);
  });

  it('caches project-root resolution across repeated loadResource calls on the same panel', async () => {
    const { triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    const stat = vscode.workspace.fs.stat as Mock;
    stat.mockClear();

    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://a.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));
    const callsAfterFirst = stat.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://b.png',
      resourceType: 'Texture2D',
      requestId: 'r2',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    // The second resource request reuses the panel's cached provider/project
    // root instead of re-walking the filesystem for it.
    expect(stat).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('clears the cached resource provider when update() receives a different document', async () => {
    const { triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage); // main scene: /workspace/scene.tscn
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    const stat = vscode.workspace.fs.stat as Mock;
    stat.mockClear();

    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://a.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));
    const callsAfterFirst = stat.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // A genuine document-identity change must drop the cached provider.
    panel.update(createMockUri('/workspace/other.tscn'));
    await new Promise<void>((r) => setTimeout(r, 10));

    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://b.png',
      resourceType: 'Texture2D',
      requestId: 'r2',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    // A fresh provider re-walks the filesystem for project-root discovery.
    expect(stat.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('recovers a resource whose initial load failed once it is created on disk (missing -> loaded)', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    // Initial load fails — the texture is referenced but doesn't exist on disk yet.
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT'));
    panel._testTriggerMessage({
      type: 'loadResource',
      path: 'res://textures/wood.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    // The file is created; the watcher fires onDidCreate -> handleDependencyChange.
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData('now exists'));
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
