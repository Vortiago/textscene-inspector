/// <reference types="vitest/globals" />

/**
 * The value-carrying halves of the `vscode` module mock: its constructible
 * classes and its enums.
 *
 * Nothing here holds a module-level spy — the stateful namespaces `afterEach`
 * clears live in `vscodeMocks.ts`. Both are assembled into the module mock by
 * `test-setup.ts`, which is the file vitest actually loads.
 */

import { vi } from 'vitest';

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
 * Mock vscode.DocumentLink class
 */
export class MockDocumentLink {
  target?: unknown;
  tooltip?: string;

  constructor(
    public range: any,
    target?: unknown
  ) {
    this.target = target;
  }
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

export const MockViewColumn = {
  One: 1,
  Two: 2,
  Three: 3,
  Active: -1,
  Beside: -2
};

export const MockFileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64
};

export const MockTextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3
};

export const MockSymbolKind: Record<string, number> = {
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
};
