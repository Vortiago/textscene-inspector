/**
 * Unit tests for dependency hot-reload. A changed dependency (texture, `.tres`,
 * instanced sub-scene) leaves the main `.tscn` unchanged, so the panel posts
 * `resourceChanged` and the webview re-fetches only that resource.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

async function createReadyPanel(
  triggerMessage: (msg: { type: string; [key: string]: unknown }) => void
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

    // The main .tscn content is unchanged, so the loadTscn path no-ops here.
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
    triggerMessage({
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
    await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    const stat = vscode.workspace.fs.stat as Mock;
    stat.mockClear();

    triggerMessage({
      type: 'loadResource',
      path: 'res://a.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));
    const callsAfterFirst = stat.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    triggerMessage({
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

    triggerMessage({
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

    triggerMessage({
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

    // The initial load fails: the texture is referenced but not on disk yet.
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT'));
    triggerMessage({
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

  it('posts resourceChanged for a deleted dependency (re-fetch fails -> missing placeholder)', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    // Establish relevance: the panel has served the resource.
    triggerMessage({
      type: 'loadResource',
      path: 'res://textures/wood.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    // The file is deleted on disk, so any further read of it fails. The watcher
    // fires onDidDelete -> handleDependencyChange, whose invalidation must not
    // depend on the file still being readable.
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT'));
    await panel.handleDependencyChange(createMockUri('/workspace/textures/wood.png'));

    // resourceChanged makes the webview re-fetch. That fetch fails and flips to
    // the magenta missing placeholder, as a failed load does.
    expect(resourceChangedCalls(webview)).toEqual([
      { type: 'resourceChanged', path: 'res://textures/wood.png' },
    ]);
  });

  it('surfaces an error and holds the last render when the panel\'s own main scene is deleted', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const panel = await createReadyPanel(triggerMessage);
    const loadTscnCalls = (): number =>
      webview.postMessage.mock.calls.filter(
        (c) => (c[0] as { type: string }).type === 'loadTscn'
      ).length;
    const loadsBefore = loadTscnCalls();

    // Main-scene file is gone; update() -> _loadTscnContent -> readFile throws.
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT: file deleted'));
    const showError = vscode.window.showErrorMessage as Mock;
    showError.mockClear();

    panel.update(createMockUri('/workspace/scene.tscn'));
    await new Promise<void>((r) => setTimeout(r, 10));

    // The panel shows an error but sends no new loadTscn, so the previous render
    // stays.
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load TSCN file')
    );
    expect(loadTscnCalls()).toBe(loadsBefore);
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
