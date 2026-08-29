/// <reference types="vitest/globals" />

/**
 * `vscode.workspace` — the filesystem, the open documents, the watchers and
 * the configuration, all as `vi.fn()` spies a test arranges per case.
 */

import { vi } from 'vitest';

/**
 * Mock vscode.workspace namespace
 * Provides filesystem and workspace operations
 */
export const mockWorkspace: any = {
  fs: {
    /**
     * Read file as Uint8Array
     * Tests should mock this to return specific content
     */
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),

    /**
     * Write file
     */
    writeFile: vi.fn().mockResolvedValue(undefined),

    /**
     * Check if file exists
     */
    stat: vi.fn().mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 }),

    /**
     * Delete file
     */
    delete: vi.fn().mockResolvedValue(undefined),

    /**
     * Create directory
     */
    createDirectory: vi.fn().mockResolvedValue(undefined),

    /**
     * Read directory
     */
    readDirectory: vi.fn().mockResolvedValue([])
  },

  /**
   * Get workspace folders
   */
  workspaceFolders: [],

  /**
   * Open text document
   */
  openTextDocument: vi.fn(),

  /**
   * Get workspace folder for Uri
   */
  getWorkspaceFolder: vi.fn(),

  /**
   * Currently open text documents
   */
  textDocuments: [],

  /**
   * On did save text document event
   */
  onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  /**
   * On did open text document event
   */
  onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  /**
   * On did change text document event
   */
  onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  /**
   * On did close text document event
   */
  onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  /**
   * Create file system watcher
   */
  createFileSystemWatcher: vi.fn().mockReturnValue({
    onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn()
  }),

  /**
   * Get configuration namespace
   */
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue)
  }),

  /**
   * On did change configuration event
   */
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() }))
};
