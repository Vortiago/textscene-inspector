/**
 * Custom assertion helpers for VSCode extension integration tests.
 */

import * as assert from 'assert';
import type { TscnPreviewPanel } from '../../../TscnPreviewPanel';

/**
 * Assert that a panel is active and not disposed.
 * @param panel The panel to check
 * @param message Optional message for assertion failure
 */
export function assertPanelActive(
  panel: TscnPreviewPanel | undefined,
  message?: string,
): asserts panel is TscnPreviewPanel {
  assert.ok(panel, message || 'Panel should exist');

  // Check if panel is disposed by trying to access its resource
  try {
    assert.ok(
      panel.resource,
      message || 'Panel should have a resource (not disposed)',
    );
  } catch {
    assert.fail(message || 'Panel appears to be disposed');
  }
}

/**
 * Assert that a panel is managing the specified resource.
 * @param panel The panel to check
 * @param resourceUri Expected resource URI
 * @param message Optional message for assertion failure
 */
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

/**
 * Assert that a specific message type was sent to the webview.
 * @param panel The panel to check
 * @param messageType Expected message type
 * @param message Optional message for assertion failure
 */
export function assertMessageSent(
  panel: TscnPreviewPanel,
  messageType: string,
  message?: string,
): void {
  const messages = (panel as unknown as { _testGetMessages?: () => unknown[] })._testGetMessages?.();

  assert.ok(
    messages,
    'Message history not available. Enable test hooks in TscnPreviewPanel.',
  );

  const found = messages.some((m) => (m as { type: string }).type === messageType);
  assert.ok(
    found,
    message ||
      `Message type '${messageType}' should have been sent to webview`,
  );
}

/**
 * Assert that a full reload message was sent.
 * @param panel The panel to check
 * @param message Optional message for assertion failure
 */
export function assertFullReloadSent(
  panel: TscnPreviewPanel,
  message?: string,
): void {
  assertMessageSent(
    panel,
    'loadTscn',
    message || 'Full reload should have been sent',
  );
}

/**
 * Assert that the number of active panels matches the expected count.
 * @param expectedCount Expected number of active panels
 * @param message Optional message for assertion failure
 */
export function assertPanelCount(
  expectedCount: number,
  message?: string,
): void {
  const panels = (global as unknown as { _testActivePanels?: Map<string, TscnPreviewPanel> })
    ._testActivePanels;

  if (!panels) {
    assert.fail(
      'Panel registry not available. Enable test hooks in TscnPreviewPanel.',
    );
  }

  assert.strictEqual(
    panels.size,
    expectedCount,
    message || `Should have ${expectedCount} active panel(s)`,
  );
}
