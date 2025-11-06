/**
 * Test helpers for managing TscnPreviewPanel instances in integration tests.
 */

import * as vscode from 'vscode';
import type { TscnPreviewPanel } from '../../../TscnPreviewPanel';

/**
 * Wait for a panel to be created and return it.
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves to the created panel
 */
export async function waitForPanelCreation(
  timeout = 5000,
): Promise<TscnPreviewPanel> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Panel creation timeout after ${timeout}ms`));
    }, timeout);

    // Listen for panel creation via extension context
    // Note: This requires TscnPreviewPanel to expose a static event emitter
    const disposable = (
      global as unknown as { _testPanelCreated?: vscode.EventEmitter<TscnPreviewPanel> }
    )._testPanelCreated?.event((panel) => {
      clearTimeout(timer);
      disposable?.dispose();
      resolve(panel);
    });

    if (!disposable) {
      clearTimeout(timer);
      reject(
        new Error(
          'Test hooks not available. Make sure TscnPreviewPanel is compiled with test support.',
        ),
      );
    }
  });
}

/**
 * Wait for a specific message type to be sent to the webview.
 * @param panel The panel to monitor
 * @param messageType The message type to wait for
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves when the message is sent
 */
export async function waitForWebviewMessage(
  panel: TscnPreviewPanel,
  messageType: string,
  timeout = 5000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Waiting for message '${messageType}' timeout after ${timeout}ms`,
        ),
      );
    }, timeout);

    // Access message history from panel (requires test hook)
    const checkMessages = () => {
      const messages = (panel as unknown as { _testGetMessages?: () => unknown[] })._testGetMessages?.();
      if (!messages) {
        clearTimeout(timer);
        reject(new Error('Message history not available in test mode'));
        return;
      }

      const message = messages.find(
        (m) => (m as { type: string }).type === messageType,
      );
      if (message) {
        clearTimeout(timer);
        resolve(message);
      }
    };

    // Poll for message
    const interval = setInterval(checkMessages, 100);
    setTimeout(() => {
      clearInterval(interval);
    }, timeout);
  });
}

/**
 * Simulate a message from the webview to the extension.
 * @param panel The panel to send the message to
 * @param message The message to send
 */
export async function sendMessageFromWebview(
  panel: TscnPreviewPanel,
  message: Record<string, unknown>,
): Promise<void> {
  // Call the test method directly on the panel to preserve 'this' binding
  const panelWithTestMethod = panel as unknown as { _testTriggerMessage?: (msg: unknown) => void };
  if (!panelWithTestMethod._testTriggerMessage) {
    throw new Error('Webview message handler not available in test mode');
  }
  // Call with proper 'this' binding
  panelWithTestMethod._testTriggerMessage.call(panel, message);
}

/**
 * Get all panels currently active.
 * @returns Array of active TscnPreviewPanel instances
 */
export function getActivePanels(): TscnPreviewPanel[] {
  const panels = (global as unknown as { _testActivePanels?: Map<string, TscnPreviewPanel> })
    ._testActivePanels;
  return panels ? Array.from(panels.values()) : [];
}

/**
 * Wait for a panel to be disposed.
 * @param panel The panel to monitor
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves when the panel is disposed
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
