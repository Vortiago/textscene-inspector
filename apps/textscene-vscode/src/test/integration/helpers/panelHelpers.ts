/**
 * Test helpers for managing TscnPreviewPanel instances in integration tests.
 *
 * Panels are constructed directly using the public constructor with a fake
 * `vscode.WebviewPanel`. The fake panel captures `postMessage` calls so tests
 * can assert host→webview messages, and exposes a `triggerMessage` helper that
 * drives the panel's `onDidReceiveMessage` handler — the same dispatch path
 * used in production.
 */

import * as vscode from 'vscode';
import { TscnPreviewPanel } from '../../../TscnPreviewPanel';
import type { HostToWebviewMessage } from '../../../protocol';

const EXTENSION_ID = 'vortiago.textscene-inspector';

/**
 * Resolve the extension's install URI from the VS Code test host.
 */
export function getExtensionUri(): vscode.Uri {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) {
    throw new Error(`Extension ${EXTENSION_ID} is not available in the test host`);
  }
  return extension.extensionUri;
}

export interface TestPanel {
  /** The `TscnPreviewPanel` under test. */
  panel: TscnPreviewPanel;
  /** All messages the panel has sent to the webview via `postMessage`. */
  sentMessages: HostToWebviewMessage[];
  /**
   * Simulate a webview→host message. Routes through the real
   * `dispatchWebviewMessage` call — the same path used in production.
   */
  triggerMessage(msg: Record<string, unknown>): void;
}

/**
 * Create a `TscnPreviewPanel` wired to a fake `vscode.WebviewPanel`.
 *
 * The fake panel captures every `postMessage` call in `sentMessages`.
 * `triggerMessage` fires the real `onDidReceiveMessage` listener that the
 * panel registered during construction, so all dispatch happens through the
 * production code path.
 */
export function createTestPanel(
  extensionUri: vscode.Uri,
  resourceUri: vscode.Uri,
): TestPanel {
  const sentMessages: HostToWebviewMessage[] = [];

  const messageListeners: Array<(msg: unknown) => void> = [];
  const disposeListeners: Array<() => void> = [];
  let disposed = false;

  const fakeWebview = {
    html: '',
    cspSource: 'vscode-webview://fake',
    postMessage: (message: unknown) => {
      sentMessages.push(message as HostToWebviewMessage);
      return Promise.resolve(true);
    },
    asWebviewUri: (uri: vscode.Uri) => uri,
    onDidReceiveMessage: (
      listener: (msg: unknown) => void,
      _thisArg?: unknown,
      _disposables?: vscode.Disposable[]
    ) => {
      messageListeners.push(listener);
      return { dispose: () => { /* no-op */ } };
    },
  };

  const fakePanel = {
    webview: fakeWebview,
    title: '',
    viewColumn: vscode.ViewColumn.Two,
    active: true,
    visible: true,
    options: {} as vscode.WebviewPanelOptions,
    viewType: TscnPreviewPanel.viewType,
    onDidDispose: (
      listener: () => void,
      _thisArg?: unknown,
      _disposables?: vscode.Disposable[]
    ) => {
      disposeListeners.push(listener);
      return { dispose: () => { /* no-op */ } };
    },
    onDidChangeViewState: (_listener: unknown) => ({ dispose: () => { /* no-op */ } }),
    reveal: (_column?: vscode.ViewColumn, _preserveFocus?: boolean) => { /* no-op */ },
    dispose: () => {
      // The real WebviewPanel is idempotent on dispose. Without this guard,
      // TscnPreviewPanel.dispose() -> fakePanel.dispose() -> onDidDispose
      // listener -> TscnPreviewPanel.dispose() recurses forever.
      if (disposed) {
        return;
      }
      disposed = true;
      for (const listener of disposeListeners) {
        listener();
      }
    },
  };

  const panel = new TscnPreviewPanel(
    fakePanel as unknown as vscode.WebviewPanel,
    extensionUri,
    resourceUri,
  );

  function triggerMessage(msg: Record<string, unknown>): void {
    for (const listener of messageListeners) {
      listener(msg);
    }
  }

  return { panel, sentMessages, triggerMessage };
}

/**
 * Wait for a specific message type to appear in `sentMessages`.
 */
export async function waitForMessage(
  sentMessages: HostToWebviewMessage[],
  messageType: string,
  timeout = 5000,
): Promise<HostToWebviewMessage> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = sentMessages.find((m) => m.type === messageType);
    if (found) {
      return found;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for message type '${messageType}' after ${timeout}ms`);
}

/**
 * Wait for a panel to be disposed.
 */
export async function waitForPanelDisposal(
  panel: TscnPreviewPanel,
  timeout = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Panel disposal timeout after ${timeout}ms`));
    }, timeout);

    const disposable = panel.onDidDispose(() => {
      clearTimeout(timer);
      disposable.dispose();
      resolve();
    });
  });
}
