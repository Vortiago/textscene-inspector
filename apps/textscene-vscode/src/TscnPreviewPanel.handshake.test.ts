/**
 * Unit test for the WI-R3F-7 webview-ready handshake (VSCODE-01 fix).
 *
 * The race: the extension host posts `loadTscn` from the panel's
 * constructor, but the React effect that installs the `message`
 * listener in the webview hasn't run yet. Without the handshake,
 * the initial payload is dropped and the preview is stuck on
 * "Loading scene…".
 *
 * The fix caches the last `loadTscn` payload until the webview
 * posts `webviewReady`, then replays it. This test exercises that
 * path against the panel's message handler.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

interface MockWebview {
  html: string;
  postMessage: Mock;
  asWebviewUri: Mock;
  onDidReceiveMessage: Mock;
  cspSource: string;
}

interface MockPanel {
  webview: MockWebview;
  title: string;
  reveal: Mock;
  dispose: Mock;
  onDidDispose: Mock;
}

function setupMockPanel(): {
  panel: MockPanel;
  webview: MockWebview;
  triggerMessage: (msg: { type: string; [key: string]: unknown }) => void;
} {
  let messageHandler:
    | ((message: { type: string; [key: string]: unknown }) => void)
    | null = null;

  const webview: MockWebview = {
    html: '',
    postMessage: vi.fn(),
    asWebviewUri: vi.fn((uri: vscode.Uri) => ({
      ...uri,
      toString: () => `vscode-webview://mock/${(uri as { fsPath: string }).fsPath}`,
    })),
    onDidReceiveMessage: vi.fn((handler: (msg: { type: string; [key: string]: unknown }) => void) => {
      messageHandler = handler;
      return { dispose: vi.fn() };
    }),
    cspSource: 'vscode-webview://mock-csp-source',
  };

  const panel: MockPanel = {
    webview,
    title: '',
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  };

  (vscode.window.createWebviewPanel as Mock).mockReturnValue(panel);

  function triggerMessage(msg: { type: string; [key: string]: unknown }): void {
    if (!messageHandler) {
      throw new Error('Panel never registered a message handler');
    }
    messageHandler(msg);
  }

  return { panel, webview, triggerMessage };
}

describe('TscnPreviewPanel webview-ready handshake (VSCODE-01)', () => {
  it('caches the initial loadTscn payload until the webview signals ready', async () => {
    const { webview, triggerMessage } = setupMockPanel();

    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(MINIMAL_TSCN)
    );

    const extensionUri = createMockUri('/extension');
    const resourceUri = createMockUri('/workspace/test.tscn');

    TscnPreviewPanel.create(extensionUri, resourceUri);

    // Allow the constructor's _loadTscnContent (async) to finish.
    await new Promise<void>((r) => setTimeout(r, 10));

    // BEFORE the handshake, no loadTscn should have been posted —
    // the payload is sitting in _pendingLoadContent.
    const loadCallsBefore = webview.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === 'loadTscn'
    );
    expect(loadCallsBefore).toHaveLength(0);

    // Webview signals ready.
    triggerMessage({ type: 'webviewReady' });

    // Now loadTscn should have fired exactly once with the cached payload.
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

    // Simulate a file-save hot-reload with new content.
    const updatedContent = MINIMAL_TSCN + '\n[node name="Added" type="Node3D" parent="."]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(updatedContent)
    );

    panel.update(resourceUri);
    await new Promise<void>((r) => setTimeout(r, 10));

    // The second loadTscn must fire immediately — no caching this time.
    const loadCalls = webview.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === 'loadTscn'
    );
    expect(loadCalls).toHaveLength(1);
    expect((loadCalls[0]![0] as { content: string }).content).toBe(updatedContent);
  });
});
