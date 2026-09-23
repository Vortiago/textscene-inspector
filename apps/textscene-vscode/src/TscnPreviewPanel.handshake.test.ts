/**
 * Unit test for the webview-ready handshake. The host posts `loadTscn` from the
 * constructor, before the webview's React effect installs its `message` listener,
 * so the payload waits for `webviewReady`. Every ready replays the last text read,
 * so a remount, which posts ready with an empty tree, gets the current scene too.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

function loadTscnContents(webview: MockWebview): string[] {
  return webview.postMessage.mock.calls
    .map((call) => call[0] as { type: string; content?: string })
    .filter((message) => message.type === 'loadTscn')
    .map((message) => message.content!);
}

describe('TscnPreviewPanel webview-ready handshake', () => {
  it('caches the initial loadTscn payload until the webview signals ready', async () => {
    const { webview, triggerMessage } = setupMockPanel();

    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(MINIMAL_TSCN)
    );

    const extensionUri = createMockUri('/extension');
    const resourceUri = createMockUri('/workspace/test.tscn');

    TscnPreviewPanel.create(extensionUri, resourceUri);

    // Let the constructor's async _loadTscnContent finish.
    await new Promise<void>((r) => setTimeout(r, 10));

    const loadCallsBefore = webview.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === 'loadTscn'
    );
    expect(loadCallsBefore).toHaveLength(0);

    triggerMessage({ type: 'webviewReady' });

    const loadCallsAfter = webview.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === 'loadTscn'
    );
    expect(loadCallsAfter).toHaveLength(1);
    expect((loadCallsAfter[0]![0] as { content: string }).content).toBe(MINIMAL_TSCN);
  });

  it('posts subsequent loadTscn directly once the webview is ready', async () => {
    const { webview, triggerMessage } = setupMockPanel();

    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(MINIMAL_TSCN)
    );

    const extensionUri = createMockUri('/extension');
    const resourceUri = createMockUri('/workspace/test.tscn');

    const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });

    // Initial replay fired.
    webview.postMessage.mockClear();

    const updatedContent = MINIMAL_TSCN + '\n[node name="Added" type="Node3D" parent="."]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(updatedContent)
    );

    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    // The second loadTscn fires at once, with no caching.
    const loadCalls = webview.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === 'loadTscn'
    );
    expect(loadCalls).toHaveLength(1);
    expect((loadCalls[0]![0] as { content: string }).content).toBe(updatedContent);
  });

  it('replays the current text on a remount ready, not only the first one', async () => {
    const { webview, triggerMessage } = setupMockPanel();

    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(MINIMAL_TSCN)
    );

    const resourceUri = createMockUri('/workspace/test.tscn');
    const panel = TscnPreviewPanel.create(createMockUri('/extension'), resourceUri);

    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });
    webview.postMessage.mockClear();

    // Moving the panel to another editor group remounts the React tree:
    // `retainContextWhenHidden` covers hidden, not remounted. The fresh tree's
    // `content` state is empty and it posts ready again.
    triggerMessage({ type: 'webviewReady' });

    expect(loadTscnContents(webview)).toEqual([MINIMAL_TSCN]);

    // And the unchanged file re-read that follows stays a no-op, because the
    // remounted webview already holds this text.
    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(loadTscnContents(webview)).toEqual([MINIMAL_TSCN]);
  });
});
