/// <reference types="vitest/globals" />

/**
 * `vscode.window`: the message dialogs, the editor, the tab groups, the webview
 * panel factory and the output channel.
 */

import { vi } from 'vitest';

export const mockWindow: any = {
  createWebviewPanel: vi.fn(),

  showInformationMessage: vi.fn(),

  showErrorMessage: vi.fn(),

  showWarningMessage: vi.fn(),

  showTextDocument: vi.fn(),

  activeTextEditor: undefined,

  /** No editor tabs open. A test that needs some assigns its own `all`. */
  tabGroups: { all: [] },

  /**
   * `logger.ts` passes `{ log: true }`, whose real return is a `LogOutputChannel`
   * with the per-level methods below, without which no relay is reachable.
   */
  createOutputChannel: vi.fn().mockReturnValue({
    append: vi.fn(),
    appendLine: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
};
