/// <reference types="vitest/globals" />

/**
 * Test setup file for VSCode extension tests.
 * Mocks VSCode API and provides test utilities.
 */

import { vi, afterEach } from 'vitest';
import * as path from 'path';

// ============================================================================
// Helper Factories
// ============================================================================

/**
 * Create a mock vscode.Uri object
 */
export function createMockUri(fsPath: string): {
  fsPath: string;
  path: string;
  scheme: string;
  authority: string;
  query: string;
  fragment: string;
  with: ReturnType<typeof vi.fn>;
  toString: () => string;
  toJSON: () => { fsPath: string; path: string; scheme: string };
} {
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
  };
}

/**
 * Create mock Uint8Array from string content
 */
export function createMockFileData(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

// ============================================================================
// VSCode API Mocks
// ============================================================================

/**
 * Mock vscode.Uri namespace
 * Provides path manipulation utilities
 */
const mockUri = {
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
 * Mock vscode.workspace namespace
 * Provides filesystem and workspace operations
 */
const mockWorkspace: any = {
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
  })
};

/**
 * Mock vscode.window namespace
 * Provides UI operations
 */
const mockWindow: any = {
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

/**
 * Mock vscode.commands namespace
 * Provides command operations
 */
const mockCommands: any = {
  /**
   * Register command
   */
  registerCommand: vi.fn()
};

/**
 * Mock vscode.Range class
 */
export class MockRange {
  constructor(
    public start: any,
    public end: any
  ) {}
}

/**
 * Mock vscode.Position class
 */
export class MockPosition {
  constructor(
    public line: number,
    public character: number
  ) {}
}

/**
 * Mock vscode.Selection class
 */
export class MockSelection {
  constructor(
    public start: any,
    public end: any
  ) {}
}

/**
 * Mock vscode.EventEmitter class
 */
export class MockEventEmitter {
  private listeners: Array<(...args: any[]) => void> = [];

  event = (listener: (...args: any[]) => void): { dispose: ReturnType<typeof vi.fn> } => {
    this.listeners.push(listener);
    return { dispose: vi.fn() };
  };

  fire(...args: any[]) {
    this.listeners.forEach(listener => listener(...args));
  }

  dispose() {
    this.listeners = [];
  }
}

/**
 * Mock vscode.DocumentSymbol class
 */
export class MockDocumentSymbol {
  children: MockDocumentSymbol[] = [];

  constructor(
    public name: string,
    public detail: string,
    public kind: number,
    public range: any,
    public selectionRange: any
  ) {}
}

/**
 * Mock vscode.Location class
 */
export class MockLocation {
  constructor(
    public uri: any,
    public range: any
  ) {}
}

/**
 * Mock vscode.Diagnostic class
 */
export class MockDiagnostic {
  code?: string | number;
  source?: string;

  constructor(
    public range: any,
    public message: string,
    public severity?: number
  ) {}
}

/**
 * Mock vscode.DiagnosticSeverity enum
 */
export const MockDiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
} as const;

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

/**
 * Mock vscode.languages namespace
 */
const mockLanguages: any = {
  registerDocumentSymbolProvider: vi.fn(),
  registerDefinitionProvider: vi.fn(),
  createDiagnosticCollection: vi.fn((name: string) => createMockDiagnosticCollection(name))
};

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
  Location: MockLocation,
  Diagnostic: MockDiagnostic,

  // Enums
  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2
  },

  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
  },

  TextEditorRevealType: {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3
  },

  SymbolKind: {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25
  }
}));

// ============================================================================
// Global Test Setup
// ============================================================================

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Export mocks for test access
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
  Location: MockLocation,
  Diagnostic: MockDiagnostic,
  DiagnosticSeverity: MockDiagnosticSeverity,
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2
  },
  TextEditorRevealType: {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3
  },
  SymbolKind: {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25
  }
};
