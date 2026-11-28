/// <reference types="vitest/globals" />

/**
 * The six `vi.fn()` namespaces of the `vscode` module mock, and the factories tests
 * build arguments with. It re-exports `vscodeWorkspaceMock.testkit` and
 * `vscodeWindowMock.testkit` as one surface. `vscodeModuleMock.testkit.ts` assembles
 * the mock, and `test-setup.ts` clears every spy after each test.
 */

import { vi } from 'vitest';
import * as path from 'path';
import type * as vscode from 'vscode';
export { mockWorkspace } from './vscodeWorkspaceMock.testkit';
export { mockWindow } from './vscodeWindowMock.testkit';

export function createMockUri(fsPath: string): vscode.Uri {
  return createMockUriForScheme(fsPath, 'file', '');
}

export function createMockUriForScheme(fsPath: string, scheme: string, authority: string): vscode.Uri {
  const normalizedPath = fsPath.replace(/\\/g, '/');

  return {
    fsPath,
    path: normalizedPath,
    scheme,
    authority,
    query: '',
    fragment: '',
    with: vi.fn(({ path }: { path?: string }) => createMockUriForScheme(path ?? fsPath, scheme, authority)),
    toString: () => `${scheme}://${authority}${normalizedPath}`,
    toJSON: () => ({ fsPath, path: normalizedPath, scheme }),
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
    dispose: vi.fn(),
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
  }),
};

export const mockCommands: any = {
  registerCommand: vi.fn(),
};

/** `vscode.env`: the clipboard the copy commands write. */
export const mockEnv: any = {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
};

/** `vscode.lm`: `registerTool` only. */
export const mockLm: any = {
  registerTool: vi.fn(() => ({ dispose: vi.fn() })),
};

export const mockLanguages: any = {
  registerDocumentSymbolProvider: vi.fn(),
  registerDefinitionProvider: vi.fn(),
  registerDocumentLinkProvider: vi.fn(),
  registerHoverProvider: vi.fn(),
  registerCompletionItemProvider: vi.fn(),
  registerCodeActionsProvider: vi.fn(),
  registerFoldingRangeProvider: vi.fn(),
  registerDocumentHighlightProvider: vi.fn(),
  registerReferenceProvider: vi.fn(),
  createDiagnosticCollection: vi.fn((name: string) => createMockDiagnosticCollection(name)),
};
