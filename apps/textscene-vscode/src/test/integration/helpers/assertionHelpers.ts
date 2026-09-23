/** Assertion helpers for the extension integration tests. */

import * as assert from 'assert';
import type { TscnPreviewPanel } from '../../../TscnPreviewPanel';
import type { HostToWebviewMessage } from '../../../protocol';

export function assertPanelActive(
  panel: TscnPreviewPanel | undefined,
  message?: string,
): asserts panel is TscnPreviewPanel {
  assert.ok(panel, message || 'Panel should exist');

  try {
    assert.ok(
      panel.resource,
      message || 'Panel should have a resource (not disposed)',
    );
  } catch {
    assert.fail(message || 'Panel appears to be disposed');
  }
}

export function assertPanelResource(
  panel: TscnPreviewPanel,
  resourceUri: string,
  message?: string,
): void {
  assert.strictEqual(
    panel.resource.fsPath,
    resourceUri,
    message || `Panel should manage resource ${resourceUri}`,
  );
}

/** Reads the `sentMessages` the fake panel captures. */
export function assertMessageSent(
  sentMessages: HostToWebviewMessage[],
  messageType: string,
  message?: string,
): void {
  const found = sentMessages.some((m) => m.type === messageType);
  assert.ok(
    found,
    message || `Message type '${messageType}' should have been sent to the webview`,
  );
}

/** A full reload is a `loadTscn` message. */
export function assertFullReloadSent(
  sentMessages: HostToWebviewMessage[],
  message?: string,
): void {
  assertMessageSent(sentMessages, 'loadTscn', message || 'Full reload should have been sent');
}
