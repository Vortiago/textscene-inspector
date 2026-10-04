/// <reference types="vitest/globals" />

/**
 * Setup file for the extension tests: it installs the `vscode` module mock and
 * clears every spy between tests. It assembles `vscodeMocks.testkit.ts` (the
 * `vi.fn()` namespaces) and `vscodeMockClasses.testkit.ts` (classes and enums), and
 * re-exports the surface tests import from `'./test-setup'`.
 */

import { vi, afterEach } from 'vitest';
import {
  mockCommands,
  mockLanguages,
  mockLm,
  mockUri,
  mockWindow,
  mockWorkspace,
} from './vscodeMocks.testkit';
import {
  MockCodeAction,
  MockCodeActionKind,
  MockCompletionItem,
  MockCompletionItemKind,
  MockCompletionItemTag,
  MockDiagnostic,
  MockDiagnosticSeverity,
  MockDocumentHighlight,
  MockDocumentHighlightKind,
  MockDocumentLink,
  MockDocumentSymbol,
  MockEventEmitter,
  MockFileType,
  MockFoldingRange,
  MockFoldingRangeKind,
  MockHover,
  MockLanguageModelDataPart,
  MockLanguageModelTextPart,
  MockLanguageModelToolResult,
  MockLocation,
  MockMarkdownString,
  MockPosition,
  MockRange,
  MockRelativePattern,
  MockSelection,
  MockSymbolKind,
  MockTabInputText,
  MockTextEditorRevealType,
  MockViewColumn,
  MockWorkspaceEdit,
} from './vscodeMockClasses.testkit';

export { createMockUri, createMockFileData, createMockDiagnosticCollection } from './vscodeMocks.testkit';
export { setupMockPanel, type MockPanel, type MockWebview } from './mockPanel.testkit';
export {
  MockCodeAction,
  MockCodeActionKind,
  MockCompletionItem,
  MockCompletionItemKind,
  MockCompletionItemTag,
  MockDiagnostic,
  MockDiagnosticSeverity,
  MockDocumentHighlight,
  MockDocumentHighlightKind,
  MockDocumentLink,
  MockDocumentSymbol,
  MockEventEmitter,
  MockFoldingRange,
  MockFoldingRangeKind,
  MockHover,
  MockLanguageModelDataPart,
  MockLanguageModelTextPart,
  MockLanguageModelToolResult,
  MockLocation,
  MockMarkdownString,
  MockPosition,
  MockRange,
  MockSelection,
  MockTabInputText,
  MockWorkspaceEdit,
} from './vscodeMockClasses.testkit';

vi.mock('vscode', () => ({
  Uri: mockUri,
  workspace: mockWorkspace,
  window: mockWindow,
  commands: mockCommands,
  languages: mockLanguages,
  lm: mockLm,
  Range: MockRange,
  Position: MockPosition,
  Selection: MockSelection,
  EventEmitter: MockEventEmitter,
  DocumentSymbol: MockDocumentSymbol,
  DocumentLink: MockDocumentLink,
  Location: MockLocation,
  Diagnostic: MockDiagnostic,
  MarkdownString: MockMarkdownString,
  Hover: MockHover,
  CompletionItem: MockCompletionItem,
  CompletionItemKind: MockCompletionItemKind,
  CompletionItemTag: MockCompletionItemTag,
  CodeAction: MockCodeAction,
  CodeActionKind: MockCodeActionKind,
  WorkspaceEdit: MockWorkspaceEdit,
  FoldingRange: MockFoldingRange,
  FoldingRangeKind: MockFoldingRangeKind,
  DocumentHighlight: MockDocumentHighlight,
  DocumentHighlightKind: MockDocumentHighlightKind,
  LanguageModelTextPart: MockLanguageModelTextPart,
  LanguageModelToolResult: MockLanguageModelToolResult,
  LanguageModelDataPart: MockLanguageModelDataPart,

  DiagnosticSeverity: MockDiagnosticSeverity,
  TabInputText: MockTabInputText,
  RelativePattern: MockRelativePattern,
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
  lm: typeof mockLm;
  Range: typeof MockRange;
  Position: typeof MockPosition;
  Selection: typeof MockSelection;
  EventEmitter: typeof MockEventEmitter;
  DocumentSymbol: typeof MockDocumentSymbol;
  DocumentLink: typeof MockDocumentLink;
  Location: typeof MockLocation;
  Diagnostic: typeof MockDiagnostic;
  MarkdownString: typeof MockMarkdownString;
  Hover: typeof MockHover;
  CompletionItem: typeof MockCompletionItem;
  CompletionItemKind: typeof MockCompletionItemKind;
  CompletionItemTag: typeof MockCompletionItemTag;
  CodeAction: typeof MockCodeAction;
  CodeActionKind: typeof MockCodeActionKind;
  WorkspaceEdit: typeof MockWorkspaceEdit;
  FoldingRange: typeof MockFoldingRange;
  FoldingRangeKind: typeof MockFoldingRangeKind;
  DocumentHighlight: typeof MockDocumentHighlight;
  DocumentHighlightKind: typeof MockDocumentHighlightKind;
  LanguageModelTextPart: typeof MockLanguageModelTextPart;
  LanguageModelToolResult: typeof MockLanguageModelToolResult;
  LanguageModelDataPart: typeof MockLanguageModelDataPart;
  DiagnosticSeverity: typeof MockDiagnosticSeverity;
  ViewColumn: { One: number; Two: number; Three: number; Active: number; Beside: number };
  TextEditorRevealType: {
    Default: number;
    InCenter: number;
    InCenterIfOutsideViewport: number;
    AtTop: number;
  };
  SymbolKind: Record<string, number>;
} = {
  Uri: mockUri,
  workspace: mockWorkspace,
  window: mockWindow,
  commands: mockCommands,
  languages: mockLanguages,
  lm: mockLm,
  Range: MockRange,
  Position: MockPosition,
  Selection: MockSelection,
  EventEmitter: MockEventEmitter,
  DocumentSymbol: MockDocumentSymbol,
  DocumentLink: MockDocumentLink,
  Location: MockLocation,
  Diagnostic: MockDiagnostic,
  MarkdownString: MockMarkdownString,
  Hover: MockHover,
  CompletionItem: MockCompletionItem,
  CompletionItemKind: MockCompletionItemKind,
  CompletionItemTag: MockCompletionItemTag,
  CodeAction: MockCodeAction,
  CodeActionKind: MockCodeActionKind,
  WorkspaceEdit: MockWorkspaceEdit,
  FoldingRange: MockFoldingRange,
  FoldingRangeKind: MockFoldingRangeKind,
  DocumentHighlight: MockDocumentHighlight,
  DocumentHighlightKind: MockDocumentHighlightKind,
  LanguageModelTextPart: MockLanguageModelTextPart,
  LanguageModelToolResult: MockLanguageModelToolResult,
  LanguageModelDataPart: MockLanguageModelDataPart,
  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: MockViewColumn,
  TextEditorRevealType: MockTextEditorRevealType,
  SymbolKind: MockSymbolKind,
};
