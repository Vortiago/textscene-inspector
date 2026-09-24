/**
 * Builds TscnPreviewPanel instances over a fake `vscode.WebviewPanel` for the
 * integration tests.
 */

import * as vscode from 'vscode';
import { TscnPreviewPanel } from '../../../TscnPreviewPanel';
import type { HostToWebviewMessage } from '../../../protocol';

const EXTENSION_ID = 'vortiago.textscene-inspector';

/** The extension's install URI in the VS Code test host. */
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
  /** Every message the panel has sent to the webview through `postMessage`. */
  sentMessages: HostToWebviewMessage[];
  /**
   * Sends a webview-to-host message through the production
   * `dispatchWebviewMessage` call.
   */
  triggerMessage(msg: Record<string, unknown>): void;
}

export interface TestPanelOptions {
  /**
   * Initial `visible` state of the fake `vscode.WebviewPanel`. `false`
   * simulates a panel hidden behind another editor (`retainContextWhenHidden`
   * keeps its webview alive). A hidden panel is also inactive. Default `true`.
   */
  visible?: boolean;
}

/**
 * Creates a `TscnPreviewPanel` over a fake `vscode.WebviewPanel`, which captures
 * every `postMessage` in `sentMessages`. `triggerMessage` fires the listener the
 * panel registered in its constructor.
 */
export function createTestPanel(
  extensionUri: vscode.Uri,
  resourceUri: vscode.Uri,
  options: TestPanelOptions = {},
): TestPanel {
  const visible = options.visible ?? true;
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
    active: visible,
    visible,
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
 * Polls every 50ms until `predicate()` is true or `timeoutMs` elapses, and returns
 * whether it held. Every integration-test wait builds on it. With
 * `describeFailure`, a timeout throws its message instead of returning `false`.
 */
export async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  describeFailure?: () => string,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  // The condition can come true during the last sleep, which a loaded CI runner
  // otherwise reports as a timeout.
  if (predicate()) {
    return true;
  }
  if (describeFailure) {
    throw new Error(describeFailure());
  }
  return false;
}

export async function waitForMessage(
  sentMessages: HostToWebviewMessage[],
  messageType: string,
  timeout = 5000,
): Promise<HostToWebviewMessage> {
  await waitFor(
    () => sentMessages.some((m) => m.type === messageType),
    timeout,
    () => `Timed out waiting for message type '${messageType}' after ${timeout}ms`,
  );
  // waitFor threw on timeout, so the message is guaranteed present.
  return sentMessages.find((m) => m.type === messageType)!;
}

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
