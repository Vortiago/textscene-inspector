/// <reference types="vitest/globals" />

/**
 * Setup file for the extension tests: it installs the `vscode` module mock and
 * clears every spy between tests. It assembles `vscodeMocks.testkit.ts` (the
 * `vi.fn()` namespaces) and `vscodeMockClasses.testkit.ts` (classes and enums), and
 * re-exports the surface tests import from `'./test-setup'`.
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

  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: MockViewColumn,
  FileType: MockFileType,
  TextEditorRevealType: MockTextEditorRevealType,
  SymbolKind: MockSymbolKind,
}));

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The objects the module mock is built from, by name: a test arranges
 * `vscode.workspace.fs.readFile` through here, not through the mocked import.
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
