/**
 * Unit tests for `TscnPreviewPanel._loadTscnContent`: an `update()` with identical
 * file content re-posts no `loadTscn`, and a rejecting `readFile` surfaces
 * "Failed to load TSCN file". `TscnPreviewPanel.hotReload.test.ts` and
 * `TscnPreviewPanel.handshake.test.ts` cover a provider switch and a real change.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

function loadTscnMessages(webview: MockWebview): unknown[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0])
    .filter((m) => (m as { type: string }).type === 'loadTscn');
}

describe('TscnPreviewPanel update() content-diff guard', () => {
  it('does not re-post loadTscn when update() is called again with byte-identical content', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    const resourceUri = createMockUri('/workspace/scene.tscn');
    const panel = TscnPreviewPanel.create(createMockUri('/extension'), resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(loadTscnMessages(webview)).toHaveLength(1);
    webview.postMessage.mockClear();

    // Same resource, same on-disk content (a save that changed nothing, or a
    // duplicate watcher event): the content-diff guard no-ops.
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(loadTscnMessages(webview)).toHaveLength(0);

    // A third identical call still no-ops: the guard compares against the latest
    // cached content, not only the first call after ready.
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(loadTscnMessages(webview)).toHaveLength(0);
  });

  it('still re-posts loadTscn once content genuinely changes after a no-op update()', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    const resourceUri = createMockUri('/workspace/scene.tscn');
    const panel = TscnPreviewPanel.create(createMockUri('/extension'), resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });
    await new Promise<void>((r) => setTimeout(r, 10));
    webview.postMessage.mockClear();

    // A no-op update first, which the guard swallows.
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(loadTscnMessages(webview)).toHaveLength(0);

    // A real change still comes through.
    const changed = MINIMAL_TSCN + '\n[node name="Child" type="Node3D" parent="."]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(changed));
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    const messages = loadTscnMessages(webview);
    expect(messages).toHaveLength(1);
    expect((messages[0] as { content: string }).content).toBe(changed);
  });
});

describe('TscnPreviewPanel _loadTscnContent error path', () => {
  it('surfaces a read failure on initial load via showErrorMessage instead of throwing', async () => {
    const { webview } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('EACCES: permission denied'));

    expect(() =>
      TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'))
    ).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(vscode.window.showErrorMessage as Mock).toHaveBeenCalledWith(
      'Failed to load TSCN file: EACCES: permission denied'
    );
    expect(loadTscnMessages(webview)).toHaveLength(0);
  });

  it('surfaces a read failure on a later update() the same way', async () => {
    const { triggerMessage } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    const resourceUri = createMockUri('/workspace/scene.tscn');
    const panel = TscnPreviewPanel.create(createMockUri('/extension'), resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });
    await new Promise<void>((r) => setTimeout(r, 10));
    (vscode.window.showErrorMessage as Mock).mockClear();

    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT: file removed'));
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(vscode.window.showErrorMessage as Mock).toHaveBeenCalledWith(
      'Failed to load TSCN file: ENOENT: file removed'
    );
  });
});
