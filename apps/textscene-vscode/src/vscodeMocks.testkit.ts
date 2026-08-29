/// <reference types="vitest/globals" />

/**
 * The stateful halves of the `vscode` module mock: its five namespaces, built
 * out of `vi.fn()` spies, plus the small factories tests build arguments with.
 * The two big ones have files of their own (`vscodeWorkspaceMock.testkit`,
 * `vscodeWindowMock.testkit`) and are re-exported here so callers see one surface.
 *
 * `test-setup.ts` assembles these (and `vscodeMockClasses.testkit.ts`) into the module
 * mock and clears every spy after each test.
 */

import { vi } from 'vitest';
import * as path from 'path';
import type * as vscode from 'vscode';
export { mockWorkspace } from './vscodeWorkspaceMock.testkit';
export { mockWindow } from './vscodeWindowMock.testkit';

// ============================================================================
// Helper Factories
// ============================================================================

/**
 * Create a mock vscode.Uri object.
 *
 * Typed as the real `Uri` so it can be passed wherever the API asks for one:
 * the structural shape it actually has cannot satisfy `Uri.with`, whose spy
 * returns `undefined` where the interface promises another `Uri`. No caller
 * calls `with`, so the assertion costs nothing a test could observe.
 */
export function createMockUri(fsPath: string): vscode.Uri {
  // Normalize path for cross-platform compatibility
  const normalizedPath = fsPath.replace(/\\/g, '/');

  return {
    fsPath: fsPath,
    path: normalizedPath,
    scheme: 'file',
    authority: '',
    query: '',
    fragment: '',
    with: vi.fn(),
    toString: () => `file://${normalizedPath}`,
    toJSON: () => ({ fsPath, path: normalizedPath, scheme: 'file' })
  } as unknown as vscode.Uri;
}

/**
 * Create mock Uint8Array from string content
 */
export function createMockFileData(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

/**
 * Create a mock vscode.DiagnosticCollection
 */
export function createMockDiagnosticCollection(name = 'mock'): {
  name: string;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  has: ReturnType<typeof vi.fn>;
  forEach: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
    forEach: vi.fn(),
    dispose: vi.fn()
  };
}

// ============================================================================
// VSCode API Mocks
// ============================================================================

/**
 * Mock vscode.Uri namespace
 * Provides path manipulation utilities
 */
export const mockUri = {
  /**
   * Join path segments
   * Example: joinPath(file:///workspace, 'scenes', 'Door.tscn')
   */
  joinPath: vi.fn((base: any, ...pathSegments: string[]) => {
    const basePath = base.fsPath || base.path || '/';
    const joined = path.posix.join(basePath, ...pathSegments);
    return createMockUri(joined);
  }),

  /**
   * Create Uri from file path
   */
  file: vi.fn((fsPath: string) => createMockUri(fsPath)),

  /**
   * Parse Uri from string
   */
  parse: vi.fn((value: string) => {
    const fsPath = value.replace('file://', '');
    return createMockUri(fsPath);
  })
};

/**
 * Mock vscode.commands namespace
 * Provides command operations
 */
export const mockCommands: any = {
  /**
   * Register command
   */
  registerCommand: vi.fn()
};

/**
 * Mock vscode.languages namespace
 */
export const mockLanguages: any = {
  registerDocumentSymbolProvider: vi.fn(),
  registerDefinitionProvider: vi.fn(),
  registerDocumentLinkProvider: vi.fn(),
  createDiagnosticCollection: vi.fn((name: string) => createMockDiagnosticCollection(name))
};
