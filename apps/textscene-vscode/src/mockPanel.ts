/// <reference types="vitest/globals" />

/**
 * Webview panel test harness.
 *
 * Separate from the `vscode` namespace mocks it wires itself into: this one
 * builds a panel and hands back the seam a test drives it through.
 */

import { vi } from 'vitest';
import { mockWindow } from './vscodeMocks';

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
  reveal: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onDidDispose: ReturnType<typeof vi.fn>;
}

/**
 * Build a mocked webview panel and wire `vscode.window.createWebviewPanel` to
 * return it. `triggerMessage` invokes the panel's real `onDidReceiveMessage`
 * handler, simulating a webview→host `postMessage`.
 */
export function setupMockPanel(): {
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
    asWebviewUri: vi.fn((uri: { fsPath: string }) => ({
      ...uri,
      toString: () => `vscode-webview://mock/${uri.fsPath}`,
    })),
    onDidReceiveMessage: vi.fn(
      (handler: (msg: { type: string; [key: string]: unknown }) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }
    ),
    cspSource: 'vscode-webview://mock-csp-source',
  };

  const panel: MockPanel = {
    webview,
    title: '',
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  };

  (mockWindow.createWebviewPanel as ReturnType<typeof vi.fn>).mockReturnValue(panel);

  function triggerMessage(msg: { type: string; [key: string]: unknown }): void {
    if (!messageHandler) {
      throw new Error('Panel never registered a message handler');
    }
    messageHandler(msg);
  }

  return { panel, webview, triggerMessage };
}
