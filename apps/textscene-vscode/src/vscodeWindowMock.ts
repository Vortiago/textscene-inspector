/// <reference types="vitest/globals" />

/**
 * `vscode.window` — the message dialogs, the editor, the webview panel factory
 * and the output channel.
 */

import { vi } from 'vitest';

/**
 * Mock vscode.window namespace
 * Provides UI operations
 */
export const mockWindow: any = {
  /**
   * Create webview panel
   */
  createWebviewPanel: vi.fn(),

  /**
   * Show information message
   */
  showInformationMessage: vi.fn(),

  /**
   * Show error message
   */
  showErrorMessage: vi.fn(),

  /**
   * Show warning message
   */
  showWarningMessage: vi.fn(),

  /**
   * Show text document in editor
   */
  showTextDocument: vi.fn(),

  /**
   * Active text editor
   */
  activeTextEditor: undefined,

  /**
   * Create output channel
   */
  createOutputChannel: vi.fn().mockReturnValue({
    append: vi.fn(),
    appendLine: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  })
};
