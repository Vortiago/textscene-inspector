/**
 * Unit tests for `dispatchWebviewMessage` and the exhaustive handler table
 * wired into `TscnPreviewPanel`.
 *
 * These tests verify that:
 * - `dispatchWebviewMessage` routes every protocol message type to the
 *   correct handler (happy path + all six types).
 * - The `webviewReady` handshake replay travels through the production
 *   dispatch path — the path that was previously unreachable from tests
 *   because `_testTriggerMessage` omitted the `webviewReady` case.
 * - The panel's `postMessage` captures let tests observe host→webview
 *   messages without any message-history plumbing in production code.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel, dispatchWebviewMessage } from './TscnPreviewPanel';
import type { WebviewToHostMessage } from './protocol';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

// ============================================================================
// dispatchWebviewMessage — standalone unit tests
// ============================================================================

describe('dispatchWebviewMessage', () => {
  it('calls the webviewReady handler for a webviewReady message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = { type: 'webviewReady' };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.webviewReady).toHaveBeenCalledWith(msg);
    expect(handlers.error).not.toHaveBeenCalled();
  });

  it('calls the error handler for an error message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = { type: 'error', message: 'boom' };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.error).toHaveBeenCalledWith(msg);
  });

  it('calls the jumpToNode handler for a jumpToNode message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = {
      type: 'jumpToNode',
      nodeName: 'Leaf',
      path: 'Root/Leaf',
      parent: '.',
    };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.jumpToNode).toHaveBeenCalledWith(msg);
  });

  it('calls the loadResource handler for a loadResource message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = {
      type: 'loadResource',
      path: 'res://tex.png',
      resourceType: 'Texture2D',
      requestId: 'r1',
    };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.loadResource).toHaveBeenCalledWith(msg);
  });

  it('calls the resourceNeeded handler for a resourceNeeded message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = {
      type: 'resourceNeeded',
      resource: { path: 'res://x.png', type: 'Texture2D', referencedBy: 'Node', error: 'miss' },
    };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.resourceNeeded).toHaveBeenCalledWith(msg);
  });

  it('calls the log handler for a log message', () => {
    const handlers = {
      webviewReady: vi.fn(),
      error: vi.fn(),
      jumpToNode: vi.fn(),
      loadResource: vi.fn(),
      resourceNeeded: vi.fn(),
      log: vi.fn(),
    };
    const msg: WebviewToHostMessage = {
      type: 'log',
      level: 'info',
      message: 'hello',
      args: [],
    };
    dispatchWebviewMessage(msg, handlers);
    expect(handlers.log).toHaveBeenCalledWith(msg);
  });
});

// ============================================================================
// webviewReady handshake through the production dispatch path
// ============================================================================

function loadTscnMessages(webview: MockWebview): unknown[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0])
    .filter((m) => (m as { type: string }).type === 'loadTscn');
}

describe('TscnPreviewPanel webviewReady through production dispatch', () => {
  it('replays a pending loadTscn payload via the production dispatch path', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'));

    // Allow the constructor's _loadTscnContent (async) to finish.
    await new Promise<void>((r) => setTimeout(r, 10));

    // Before the handshake no loadTscn must have been posted.
    expect(loadTscnMessages(webview)).toHaveLength(0);

    // The webviewReady message reaches the handler through the same
    // dispatchWebviewMessage call used in production — the path that was
    // previously untestable via _testTriggerMessage (which omitted the case).
    triggerMessage({ type: 'webviewReady' });

    const calls = loadTscnMessages(webview);
    expect(calls).toHaveLength(1);
    expect((calls[0] as { content: string }).content).toBe(MINIMAL_TSCN);
  });

  it('uses the fake panel postMessage captures as the sole observation mechanism', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'));
    await new Promise<void>((r) => setTimeout(r, 10));
    triggerMessage({ type: 'webviewReady' });

    // The single observation mechanism is the captured fake panel.webview.postMessage —
    // no _testGetMessages or _messageHistory is involved.
    const allMessages = webview.postMessage.mock.calls.map((c) => c[0]);
    const loadTscn = allMessages.find((m) => (m as { type: string }).type === 'loadTscn');
    expect(loadTscn).toBeDefined();
    expect((loadTscn as { content: string }).content).toBe(MINIMAL_TSCN);
  });
});

// ============================================================================
// All message types driven through the fake panel's onDidReceiveMessage
// ============================================================================

describe('TscnPreviewPanel — all message types through fake onDidReceiveMessage', () => {
  async function makeReadyPanel(
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

  it('error: surfaces the message via showErrorMessage', async () => {
    const { triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);

    triggerMessage({ type: 'error', message: 'renderer exploded' });

    expect(vscode.window.showErrorMessage as Mock).toHaveBeenCalledWith('renderer exploded');
  });

  it('jumpToNode: opens the text document and positions the editor', async () => {
    const { triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);

    const editor = { selection: undefined as unknown, revealRange: vi.fn() };
    (vscode.workspace.openTextDocument as Mock).mockResolvedValue({
      getText: () => MINIMAL_TSCN,
    });
    (vscode.window.showTextDocument as Mock).mockResolvedValue(editor);

    triggerMessage({ type: 'jumpToNode', nodeName: 'Root', path: 'Root' });
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(vscode.window.showTextDocument as Mock).toHaveBeenCalled();
    expect(editor.revealRange).toHaveBeenCalled();
  });

  it('loadResource: posts resourceLoaded for a text resource', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    const subText = '[gd_scene format=3]\n[node name="Sub" type="Node3D"]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(subText));

    triggerMessage({
      type: 'loadResource',
      path: 'res://scenes/Sub.tscn',
      resourceType: 'PackedScene',
      requestId: 'rq1',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const loaded = webview.postMessage.mock.calls
      .map((c) => c[0])
      .find((m) => (m as { type: string }).type === 'resourceLoaded');
    expect(loaded).toBeDefined();
    expect((loaded as { requestId: string }).requestId).toBe('rq1');
  });

  it('resourceNeeded: logs to the output channel without throwing', async () => {
    const { triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);

    expect(() =>
      triggerMessage({
        type: 'resourceNeeded',
        resource: {
          path: 'res://missing.png',
          type: 'Texture2D',
          referencedBy: 'TestNode',
          error: 'not found',
        },
      })
    ).not.toThrow();
  });

  it('log: does not throw even when no output channel is initialised', async () => {
    const { triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);

    expect(() =>
      triggerMessage({
        type: 'log',
        level: 'info',
        message: 'hello from webview',
        args: [],
      })
    ).not.toThrow();
  });
});
