/// <reference types="vitest/globals" />

/**
 * The five `vi.fn()` namespaces of the `vscode` module mock, and the factories tests
 * build arguments with. It re-exports `vscodeWorkspaceMock.testkit` and
 * `vscodeWindowMock.testkit` as one surface. `test-setup.ts` assembles the mock and
 * clears every spy after each test.
 */

import { vi } from 'vitest';
import * as path from 'path';
import type * as vscode from 'vscode';
export { mockWorkspace } from './vscodeWorkspaceMock.testkit';
export { mockWindow } from './vscodeWindowMock.testkit';

/**
 * Typed as the real `Uri`, so it passes wherever the API asks for one, though
 * its `with` spy returns `undefined` where the interface promises a `Uri`. No
 * caller calls `with`.
 */
export function createMockUri(fsPath: string): vscode.Uri {
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

export function createMockFileData(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

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

export const mockUri = {
  joinPath: vi.fn((base: any, ...pathSegments: string[]) => {
    const basePath = base.fsPath || base.path || '/';
    const joined = path.posix.join(basePath, ...pathSegments);
    return createMockUri(joined);
  }),

  file: vi.fn((fsPath: string) => createMockUri(fsPath)),

  parse: vi.fn((value: string) => {
    const fsPath = value.replace('file://', '');
    return createMockUri(fsPath);
  })
};

export const mockCommands: any = {
  registerCommand: vi.fn()
};

export const mockLanguages: any = {
  registerDocumentSymbolProvider: vi.fn(),
  registerDefinitionProvider: vi.fn(),
  registerDocumentLinkProvider: vi.fn(),
  createDiagnosticCollection: vi.fn((name: string) => createMockDiagnosticCollection(name))
};
