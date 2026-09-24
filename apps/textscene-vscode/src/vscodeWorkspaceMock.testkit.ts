/// <reference types="vitest/globals" />

/**
 * `vscode.workspace`: the filesystem, the open documents, the watchers and
 * the configuration, all as `vi.fn()` spies a test arranges per case.
 */

import { vi } from 'vitest';

export const mockWorkspace: any = {
  fs: {
    /** A test arranges the content it returns. */
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),

    writeFile: vi.fn().mockResolvedValue(undefined),

    stat: vi.fn().mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 }),

    delete: vi.fn().mockResolvedValue(undefined),

    createDirectory: vi.fn().mockResolvedValue(undefined),

    readDirectory: vi.fn().mockResolvedValue([])
  },

  workspaceFolders: [],

  openTextDocument: vi.fn(),

  getWorkspaceFolder: vi.fn(),

  textDocuments: [],

  onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),

  createFileSystemWatcher: vi.fn().mockReturnValue({
    onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn()
  }),

  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue)
  }),

  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() }))
};
