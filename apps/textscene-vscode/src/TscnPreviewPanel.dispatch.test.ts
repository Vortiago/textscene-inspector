/**
 * Unit tests for `dispatchWebviewMessage` and the handler table `TscnPreviewPanel`
 * wires into it. The dispatcher routes every message type and narrows the receiver
 * first, since a webview can post anything. The tests observe host-to-webview
 * messages through the fake panel's `postMessage`, with no plumbing in production.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel, dispatchWebviewMessage } from './TscnPreviewPanel';
import { isWebviewToHostMessage, type WebviewToHostMessage } from './protocol';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

function makeHandlers() {
  return {
    webviewReady: vi.fn(),
    error: vi.fn(),
    jumpToNode: vi.fn(),
    loadResource: vi.fn(),
    resourceNeeded: vi.fn(),
    log: vi.fn(),
  };
}

describe('dispatchWebviewMessage', () => {
  const ROUTING_CASES: WebviewToHostMessage[] = [
    { type: 'webviewReady' },
    { type: 'error', message: 'boom' },
    { type: 'jumpToNode', nodeName: 'Leaf', path: 'Root/Leaf', parent: '.' },
    { type: 'loadResource', path: 'res://tex.png', resourceType: 'Texture2D', requestId: 'r1' },
    {
      type: 'resourceNeeded',
      resource: { path: 'res://x.png', type: 'Texture2D', referencedBy: 'Node', error: 'miss' },
    },
    { type: 'log', level: 'info', message: 'hello', args: [] },
  ];

  it.each(ROUTING_CASES)('routes a $type message to its handler only', (msg) => {
    const handlers = makeHandlers();
    dispatchWebviewMessage(msg, handlers);
    for (const [type, handler] of Object.entries(handlers)) {
      if (type === msg.type) {
        expect(handler).toHaveBeenCalledWith(msg);
      } else {
        expect(handler).not.toHaveBeenCalled();
      }
    }
  });

  it('silently ignores a runtime message whose type has no table entry', () => {
    const handlers = makeHandlers();
    const unknown = { type: 'unknownMessageType', data: 'x' } as unknown as WebviewToHostMessage;
    expect(() => dispatchWebviewMessage(unknown, handlers)).not.toThrow();
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });

  // The receiver, not the key: `postMessage(null)` reads `null.type` unless the
  // dispatcher narrows first, and `onDidReceiveMessage` has no catch around it.
  const NON_MESSAGES: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a bare string', 'webviewReady'],
    ['an object carrying no type', { data: 'x' }],
    ['an object whose type is not a string', { type: 42 }],
  ];

  it.each(NON_MESSAGES)('rejects %s at the guard and dispatches nothing', (_label, msg) => {
    // Both halves: the guard's own verdict, and that the dispatcher returns
    // rather than throwing out of the host's uncaught listener.
    expect(isWebviewToHostMessage(msg)).toBe(false);

    const handlers = makeHandlers();
    expect(() => dispatchWebviewMessage(msg, handlers)).not.toThrow();
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });

  it.each(ROUTING_CASES)('accepts a real $type message at the guard', (msg) => {
    expect(isWebviewToHostMessage(msg)).toBe(true);
  });
});

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

    // Let the constructor's async _loadTscnContent finish.
    await new Promise<void>((r) => setTimeout(r, 10));

    expect(loadTscnMessages(webview)).toHaveLength(0);

    // webviewReady reaches the handler through the production
    // dispatchWebviewMessage call.
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

    const allMessages = webview.postMessage.mock.calls.map((c) => c[0]);
    const loadTscn = allMessages.find((m) => (m as { type: string }).type === 'loadTscn');
    expect(loadTscn).toBeDefined();
    expect((loadTscn as { content: string }).content).toBe(MINIMAL_TSCN);
  });
});

describe('TscnPreviewPanel — all message types through fake onDidReceiveMessage', () => {
  async function makeReadyPanel(
    triggerMessage: (msg: unknown) => void
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

  it('null: the production listener survives a webview posting a non-object', async () => {
    const { triggerMessage } = setupMockPanel();
    await makeReadyPanel(triggerMessage);

    // Nothing catches inside `onDidReceiveMessage`, so a throw here escapes
    // into the extension host.
    expect(() => triggerMessage(null)).not.toThrow();
  });
});

describe('a message whose type is known but whose body is not', () => {
  const handlers = () => ({
    webviewReady: vi.fn(),
    error: vi.fn(),
    jumpToNode: vi.fn(),
    loadResource: vi.fn(),
    resourceNeeded: vi.fn(),
    log: vi.fn(),
  });

  it('drops a log with no args array, which the relay would call .map on', () => {
    const h = handlers();
    dispatchWebviewMessage({ type: 'log', level: 'warn', message: 'x' }, h);
    expect(h.log).not.toHaveBeenCalled();
  });

  it('drops a resourceNeeded with no resource, whose fields the relay reads', () => {
    const h = handlers();
    dispatchWebviewMessage({ type: 'resourceNeeded' }, h);
    expect(h.resourceNeeded).not.toHaveBeenCalled();
  });

  it('drops a jumpToNode whose path is not a string', () => {
    const h = handlers();
    dispatchWebviewMessage({ type: 'jumpToNode', nodeName: 'N', path: 7 }, h);
    expect(h.jumpToNode).not.toHaveBeenCalled();
  });

  it('still routes a root jumpToNode, whose optional parent is absent', () => {
    const h = handlers();
    dispatchWebviewMessage({ type: 'jumpToNode', nodeName: 'Root', path: 'Root' }, h);
    expect(h.jumpToNode).toHaveBeenCalledTimes(1);
  });

  it('still routes a well-formed log', () => {
    const h = handlers();
    dispatchWebviewMessage({ type: 'log', level: 'warn', message: 'x', args: [] }, h);
    expect(h.log).toHaveBeenCalledTimes(1);
  });
});
