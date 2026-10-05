/// <reference types="vitest/globals" />

/**
 * Setup file for the extension tests: it installs the `vscode` module mock and
 * clears every spy between tests. The mock is `vscodeModuleMock.testkit.ts`, built
 * from `vscodeMocks.testkit.ts` (the `vi.fn()` namespaces) and
 * `vscodeMockClasses.testkit.ts` (classes and enums). This re-exports the surface
 * tests import from `'./test-setup'`.
 */

import { vi, afterEach } from 'vitest';
import { vscodeModuleMock } from './vscodeModuleMock.testkit';

export { createMockUri, createMockFileData, createMockDiagnosticCollection } from './vscodeMocks.testkit';
export { setupMockPanel, type MockPanel, type MockWebview } from './mockPanel.testkit';
export * from './vscodeMockClasses.testkit';

vi.mock('vscode', () => vscodeModuleMock);

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The objects the module mock is built from, by name: a test arranges
 * `vscode.workspace.fs.readFile` through here, not through the mocked import.
 */
export const vscode = vscodeModuleMock;
