/// <reference types="vitest/globals" />

/**
 * Webview panel test harness: it builds a panel, wires it into the `vscode`
 * namespace mocks, and hands back the seams a test drives it through.
 */

import { vi } from 'vitest';
import { mockWindow } from './vscodeMocks.testkit';

/** What a `vscode.Event` hands back, and what its `disposables` array collects. */
export interface MockSubscription {
  dispose: ReturnType<typeof vi.fn>;
}

export interface MockWebview {
  html: string;
  postMessage: ReturnType<typeof vi.fn>;
  asWebviewUri: ReturnType<typeof vi.fn>;
  onDidReceiveMessage: ReturnType<typeof vi.fn>;
  cspSource: string;
}

export interface MockPanel {
  webview: MockWebview;
  title: string;
  /** The panel's column, as a real `WebviewPanel` reports it. Unset, the panel is in none. */
  viewColumn?: number;
  reveal: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onDidDispose: ReturnType<typeof vi.fn>;
}

export interface MockPanelHarness {
  panel: MockPanel;
  webview: MockWebview;
  /** Invoke the panel's real `onDidReceiveMessage` handler (a webview→host post). */
  triggerMessage: (msg: unknown) => void;
  /** Invoke the panel's real `onDidDispose` handler (VS Code closing the tab). */
  fireDidDispose: () => void;
  /** The subscription `onDidReceiveMessage` returned, so teardown is observable. */
  messageSubscription: MockSubscription;
  /** The subscription `onDidDispose` returned. */
  didDisposeSubscription: MockSubscription;
}

/**
 * Builds a mocked webview panel that `vscode.window.createWebviewPanel` returns.
 * Both event mocks take the real `(listener, thisArgs?, disposables?)` signature
 * and push their subscription into `disposables`. A one-argument mock leaves
 * `_disposables` empty, so a teardown test passes whatever production registers.
 */
export function setupMockPanel(): MockPanelHarness {
  let messageHandler: ((message: unknown) => void) | null = null;
  let didDisposeHandler: (() => void) | null = null;

  const messageSubscription: MockSubscription = { dispose: vi.fn() };
  const didDisposeSubscription: MockSubscription = { dispose: vi.fn() };

  const webview: MockWebview = {
    html: '',
    postMessage: vi.fn(),
    asWebviewUri: vi.fn((uri: { fsPath: string }) => ({
      ...uri,
      toString: () => `vscode-webview://mock/${uri.fsPath}`,
    })),
    onDidReceiveMessage: vi.fn(
      (
        handler: (msg: unknown) => void,
        thisArgs?: unknown,
        disposables?: MockSubscription[]
      ) => {
        messageHandler = thisArgs == null ? handler : handler.bind(thisArgs);
        disposables?.push(messageSubscription);
        return messageSubscription;
      }
    ),
    cspSource: 'vscode-webview://mock-csp-source',
  };

  const panel: MockPanel = {
    webview,
    title: '',
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: vi.fn(
      (handler: () => void, thisArgs?: unknown, disposables?: MockSubscription[]) => {
        didDisposeHandler = thisArgs == null ? handler : handler.bind(thisArgs);
        disposables?.push(didDisposeSubscription);
        return didDisposeSubscription;
      }
    ),
  };

  (mockWindow.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(panel);

  function triggerMessage(msg: unknown): void {
    if (!messageHandler) {
      throw new Error('Panel never registered a message handler');
    }
    messageHandler(msg);
  }

  function fireDidDispose(): void {
    if (!didDisposeHandler) {
      throw new Error('Panel never registered an onDidDispose handler');
    }
    didDisposeHandler();
  }

  return {
    panel,
    webview,
    triggerMessage,
    fireDidDispose,
    messageSubscription,
    didDisposeSubscription,
  };
}
