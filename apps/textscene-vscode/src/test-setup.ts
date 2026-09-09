/// <reference types="vitest/globals" />

/**
 * Test setup file for VSCode extension tests (`vitest.config.ts` → setupFiles).
 *
 * Two jobs, and both have to happen HERE: installing the `vscode` module mock,
 * and clearing every spy between tests. The mock's own pieces live in
 * `vscodeMocks.testkit.ts` (the `vi.fn()` namespaces) and `vscodeMockClasses.testkit.ts` (the
 * classes and enums) — this file assembles them, and re-exports the surface a
 * dozen tests import from `'./test-setup'`.
 */

import { vi, afterEach } from 'vitest';
import { mockCommands, mockLanguages, mockUri, mockWindow, mockWorkspace } from './vscodeMocks.testkit';
import {
  MockDiagnostic,
  MockDiagnosticSeverity,
  MockDocumentLink,
  MockDocumentSymbol,
  MockEventEmitter,
  MockFileType,
  MockLocation,
  MockPosition,
  MockRange,
  MockSelection,
  MockSymbolKind,
  MockTextEditorRevealType,
  MockViewColumn,
} from './vscodeMockClasses.testkit';

export { createMockUri, createMockFileData, createMockDiagnosticCollection } from './vscodeMocks.testkit';
export { setupMockPanel, type MockPanel, type MockWebview } from './mockPanel.testkit';
export {
  MockDiagnostic,
  MockDiagnosticSeverity,
  MockDocumentLink,
  MockDocumentSymbol,
  MockEventEmitter,
  MockLocation,
  MockPosition,
  MockRange,
  MockSelection,
} from './vscodeMockClasses.testkit';

// ============================================================================
// VSCode Module Mock
// ============================================================================

/**
 * Complete vscode module mock
 * Add more APIs as needed by tests
 */
vi.mock('vscode', () => ({
  Uri: mockUri,
  workspace: mockWorkspace,
  window: mockWindow,
  commands: mockCommands,
  languages: mockLanguages,
  Range: MockRange,
  Position: MockPosition,
  Selection: MockSelection,
  EventEmitter: MockEventEmitter,
  DocumentSymbol: MockDocumentSymbol,
  DocumentLink: MockDocumentLink,
  Location: MockLocation,
  Diagnostic: MockDiagnostic,

  // Enums
  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: MockViewColumn,
  FileType: MockFileType,
  TextEditorRevealType: MockTextEditorRevealType,
  SymbolKind: MockSymbolKind,
}));

// ============================================================================
// Global Test Setup
// ============================================================================

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The same objects the module mock is built from, reachable by name — a test
 * that needs to arrange `vscode.workspace.fs.readFile` reads it from here
 * rather than re-deriving it from the mocked import.
 */
export const vscode: {
  Uri: typeof mockUri;
  workspace: typeof mockWorkspace;
  window: typeof mockWindow;
  commands: typeof mockCommands;
  languages: typeof mockLanguages;
  Range: typeof MockRange;
  Position: typeof MockPosition;
  Selection: typeof MockSelection;
  EventEmitter: typeof MockEventEmitter;
  DocumentSymbol: typeof MockDocumentSymbol;
  DocumentLink: typeof MockDocumentLink;
  Location: typeof MockLocation;
  Diagnostic: typeof MockDiagnostic;
  DiagnosticSeverity: typeof MockDiagnosticSeverity;
  ViewColumn: { One: number; Two: number; Three: number; Active: number; Beside: number };
  TextEditorRevealType: { Default: number; InCenter: number; InCenterIfOutsideViewport: number; AtTop: number };
  SymbolKind: Record<string, number>;
} = {
  Uri: mockUri,
  workspace: mockWorkspace,
  window: mockWindow,
  commands: mockCommands,
  languages: mockLanguages,
  Range: MockRange,
  Position: MockPosition,
  Selection: MockSelection,
  EventEmitter: MockEventEmitter,
  DocumentSymbol: MockDocumentSymbol,
  DocumentLink: MockDocumentLink,
  Location: MockLocation,
  Diagnostic: MockDiagnostic,
  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: MockViewColumn,
  TextEditorRevealType: MockTextEditorRevealType,
  SymbolKind: MockSymbolKind,
};
